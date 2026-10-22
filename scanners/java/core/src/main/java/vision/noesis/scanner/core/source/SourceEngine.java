package vision.noesis.scanner.core.source;

import com.sun.source.tree.CompilationUnitTree;
import java.io.IOException;
import vision.noesis.scanner.core.ArtifactInput;
import vision.noesis.scanner.core.ArtifactNodes;
import vision.noesis.scanner.core.Diagnostics;
import vision.noesis.scanner.core.Engine;
import vision.noesis.scanner.core.EngineKind;
import vision.noesis.scanner.core.ModelBuilder;
import vision.noesis.scanner.core.ScanSession;
import vision.noesis.scanner.model.ArtifactNode;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.NodeId;

/**
 * The javac engine: parses and attributes the artifact's sources against its compile classpath, then walks declarations,
 * bodies and the external closure. Code that does not compile still yields a model: unbound names become unresolved
 * references and unbound sites become diagnostics.
 */
public final class SourceEngine implements Engine {

    @Override
    public CodeModelFile scan(ArtifactInput input, ScanSession session) {
        ModelBuilder builder = new ModelBuilder();
        NodeId artifactId = input.id();
        ArtifactNode artifact = ArtifactNodes.of(input, session, artifactId, EngineKind.SOURCE);
        try (JavacSession javac = JavacSession.open(input)) {
            if (javac == null) {
                builder.diagnostic(Diagnostics.error(Diagnostics.NO_COMPILER, "No Java compiler in this JVM; run the scanner on a JDK."));
                return builder.build(session.generator(), artifact, session);
            }
            if (javac.release() != input.release()) {
                builder.diagnostic(Diagnostics.warning(Diagnostics.RELEASE_NOT_SUPPORTED, "Release " + input.release() + " is not supported by the running JDK "
                        + Runtime.version().feature() + "; the sources are bound against release " + javac.release() + ". Run the build on a JDK of release " + input.release() + " or newer."));
            }
            SourceContext context = new SourceContext(input, session, javac, builder, artifactId);
            SourceDeclarations declarations = new SourceDeclarations(context);
            for (CompilationUnitTree unit : javac.units()) declarations.walkUnit(unit);
            SourceBodies bodies = new SourceBodies(context, declarations);
            for (CompilationUnitTree unit : javac.units()) bodies.scanUnit(unit);
            declarations.emitNamespaces(artifactId);
            SourceClosure.collect(context);
            SourceDiagnostics.addAll(context);
        } catch (IOException | RuntimeException | StackOverflowError e) {
            return Diagnostics.notScanned(input, artifact, session, Diagnostics.describe(e));
        }
        return builder.build(session.generator(), artifact, session);
    }
}
