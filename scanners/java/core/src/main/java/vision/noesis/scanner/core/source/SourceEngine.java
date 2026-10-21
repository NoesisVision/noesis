package vision.noesis.scanner.core.source;

import com.sun.source.tree.CompilationUnitTree;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import vision.noesis.scanner.core.ArtifactInput;
import vision.noesis.scanner.core.ClasspathEntry;
import vision.noesis.scanner.core.Diagnostics;
import vision.noesis.scanner.core.Engine;
import vision.noesis.scanner.core.EngineKind;
import vision.noesis.scanner.core.ModelBuilder;
import vision.noesis.scanner.core.ScanSession;
import vision.noesis.scanner.core.java.JavaIds;
import vision.noesis.scanner.model.ArtifactDependency;
import vision.noesis.scanner.model.ArtifactKind;
import vision.noesis.scanner.model.ArtifactNode;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.LanguageBag;
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
        ArtifactNode artifact = artifactOf(input, session, artifactId);
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

    static ArtifactNode artifactOf(ArtifactInput input, ScanSession session, NodeId id) {
        Map<String, Object> bag = new LinkedHashMap<>();
        bag.put("java.groupId", input.groupId());
        bag.put("java.packaging", input.packaging());
        if (input.buildFile() != null) bag.put("java.buildFile", session.locations().relativePath(input.buildFile()));
        bag.put("java.engine", EngineKind.SOURCE.id());
        if (input.mainClass() != null) bag.put("java.mainClass", input.mainClass());
        return new ArtifactNode(
                id,
                ArtifactKind.SOURCE,
                input.artifactId(),
                input.version(),
                session.locations().relativePath(input.rootDirectory()),
                "jdk-" + input.release(),
                input.executable(),
                dependenciesOf(input),
                List.of(),
                LanguageBag.of(bag));
    }

    static List<ArtifactDependency> dependenciesOf(ArtifactInput input) {
        TreeMap<NodeId, ArtifactDependency> dependencies = new TreeMap<>();
        for (ClasspathEntry entry : input.classpath()) dependencies.putIfAbsent(entry.dependency().id(), entry.dependency());
        return new ArrayList<>(dependencies.values());
    }
}
