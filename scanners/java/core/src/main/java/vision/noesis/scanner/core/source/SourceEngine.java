package vision.noesis.scanner.core.source;

import com.sun.source.tree.CompilationUnitTree;
import java.io.IOException;
import java.util.HashSet;
import java.util.Set;
import java.util.function.BiConsumer;
import vision.noesis.scanner.core.ArtifactInput;
import vision.noesis.scanner.core.ArtifactNodes;
import vision.noesis.scanner.core.Diagnostics;
import vision.noesis.scanner.core.Engine;
import vision.noesis.scanner.core.EngineKind;
import vision.noesis.scanner.core.LargeStack;
import vision.noesis.scanner.core.ModelBuilder;
import vision.noesis.scanner.core.ScanSession;
import vision.noesis.scanner.model.ArtifactNode;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.NodeId;

/**
 * The javac engine: parses and attributes the artifact's sources against its compile classpath, then walks declarations,
 * bodies and the external closure. Code that does not compile still yields a model: unbound names become unresolved
 * references and unbound sites become diagnostics. A file the walk fails on costs that file, not the module: its
 * declarations, or only its bodies' facts, are dropped with an {@code NS1010}. The scan runs on a thread with a large
 * stack, so a deeply nested expression does not overflow.
 */
public final class SourceEngine implements Engine {

    /** The two walks over each file. */
    enum Pass { DECLARATIONS, BODIES }

    /** Runs before each file's walk; a test throws from it to stand in for a bug in a walker. */
    private final BiConsumer<Pass, CompilationUnitTree> beforeWalk;

    public SourceEngine() {
        this((pass, unit) -> {});
    }

    SourceEngine(BiConsumer<Pass, CompilationUnitTree> beforeWalk) {
        this.beforeWalk = beforeWalk;
    }

    @Override
    public CodeModelFile scan(ArtifactInput input, ScanSession session) {
        return LargeStack.call("noesis-source-scan-" + input.artifactId(), () -> scanOnThisThread(input, session));
    }

    private CodeModelFile scanOnThisThread(ArtifactInput input, ScanSession session) {
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
            Set<CompilationUnitTree> undeclared = new HashSet<>();
            for (CompilationUnitTree unit : javac.units()) {
                NodeId namespaceId = declarations.namespaceOf(unit);
                ModelBuilder.Mark mark = builder.mark();
                try {
                    beforeWalk.accept(Pass.DECLARATIONS, unit);
                    declarations.walkTypes(unit, namespaceId);
                } catch (RuntimeException | StackOverflowError e) {
                    builder.rollback(mark);
                    undeclared.add(unit);
                    builder.diagnostic(Diagnostics.error(Diagnostics.FILE_NOT_SCANNED, "The declarations of " + context.locations.fileOf(unit)
                            + " could not be scanned, so the file is missing from the model: " + Diagnostics.describe(e), context.locations.span(unit, 0, 0)));
                }
            }
            SourceBodies bodies = new SourceBodies(context, declarations);
            for (CompilationUnitTree unit : javac.units()) {
                if (undeclared.contains(unit)) continue;
                ModelBuilder.Mark mark = builder.mark();
                try {
                    beforeWalk.accept(Pass.BODIES, unit);
                    bodies.scanUnit(unit);
                } catch (RuntimeException | StackOverflowError e) {
                    builder.rollback(mark);
                    // The walker was left mid-member; the next file starts from a fresh one.
                    bodies = new SourceBodies(context, declarations);
                    builder.diagnostic(Diagnostics.warning(Diagnostics.FILE_NOT_SCANNED, "The bodies of " + context.locations.fileOf(unit)
                            + " could not be scanned, so their calls, accesses and type uses are missing: " + Diagnostics.describe(e), context.locations.span(unit, 0, 0)));
                }
            }
            declarations.emitNamespaces(artifactId);
            SourceClosure.collect(context);
            SourceDiagnostics.addAll(context);
        } catch (IOException | RuntimeException | StackOverflowError e) {
            return Diagnostics.notScanned(input, artifact, session, Diagnostics.describe(e));
        }
        return builder.build(session.generator(), artifact, session);
    }
}
