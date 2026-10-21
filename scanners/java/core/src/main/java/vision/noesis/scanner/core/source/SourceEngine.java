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
import vision.noesis.scanner.core.java.JavaIds;
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
        NodeId artifactId = JavaIds.artifact(input.artifactId());
        ArtifactNode artifact = ArtifactNodes.of(input, session, artifactId, EngineKind.SOURCE);
        try (JavacSession javac = JavacSession.open(input)) {
            if (javac == null) {
                builder.diagnostic(Diagnostics.error(Diagnostics.NO_COMPILER, "No Java compiler in this JVM; run the scanner on a JDK."));
                return builder.build(session.generator(), artifact, session);
            }
            SourceContext context = new SourceContext(input, session, javac, builder, artifactId);
            SourceDeclarations declarations = new SourceDeclarations(context);
            for (CompilationUnitTree unit : javac.units()) declarations.walkUnit(unit);
            SourceBodies bodies = new SourceBodies(context, declarations);
            for (CompilationUnitTree unit : javac.units()) bodies.scanUnit(unit);
            declarations.emitNamespaces(artifactId);
            SourceClosure.collect(context);
            SourceDiagnostics.addAll(context);
        } catch (IOException | RuntimeException e) {
            builder.diagnostic(Diagnostics.error(Diagnostics.MODULE_NOT_SCANNED, "Module " + input.artifactId() + " could not be scanned: " + describe(e)));
        }
        return builder.build(session.generator(), artifact, session);
    }

    /** The exception and where in the scanner it surfaced, so a report is actionable without a stack trace. */
    private static String describe(Exception e) {
        StringBuilder text = new StringBuilder(e.toString());
        for (StackTraceElement frame : e.getStackTrace()) {
            if (frame.getClassName().startsWith("vision.noesis.")) {
                text.append(" at ").append(frame.getClassName()).append('.').append(frame.getMethodName()).append(':').append(frame.getLineNumber());
                break;
            }
        }
        return text.toString();
    }
}
