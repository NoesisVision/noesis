package vision.noesis.parser.core.source;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.source.tree.CompilationUnitTree;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BiConsumer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vision.noesis.parser.core.ArtifactInput;
import vision.noesis.parser.core.Diagnostics;
import vision.noesis.parser.core.EngineKind;
import vision.noesis.parser.core.ParseRequest;
import vision.noesis.parser.core.ParseSession;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.Diagnostic;
import vision.noesis.parser.model.DiagnosticSeverity;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.Generator;

/** A failure in one file costs that file, not the module; a deeply nested expression does not overflow the stack. */
class SourceEngineFailureTest {

    private static final Map<String, String> SOURCES = Map.of(
            "p/A.java", """
                    package p;
                    public class A {
                        public int a() { return new B().b(); }
                    }
                    """,
            "p/B.java", """
                    package p;
                    public class B {
                        public int b() { return Integer.parseInt("1"); }
                    }
                    """);

    @TempDir
    Path root;

    @Test
    void aFileWhoseDeclarationsFailIsDroppedAndTheOthersAreKept() throws IOException {
        CodeModelFile model = parse(SOURCES, failing(SourceEngine.Pass.DECLARATIONS, "B.java"));

        List<String> ids = ids(model);
        assertTrue(ids.contains("T:p.A"), ids.toString());
        assertTrue(ids.contains("M:p.A#a()"), ids.toString());
        assertFalse(ids.contains("T:p.B"), ids.toString());
        // The package is A's too.
        assertTrue(ids.contains("N:p"), ids.toString());
        Diagnostic failure = only(model, Diagnostics.FILE_NOT_PARSED);
        assertEquals(DiagnosticSeverity.ERROR, failure.severity());
        assertEquals("src/p/B.java", failure.location().file());
        assertTrue(failure.message().contains("walker bug"), failure.message());
        assertTrue(model.diagnostics().stream().noneMatch(d -> d.code().equals(Diagnostics.MODULE_NOT_PARSED)), model.diagnostics().toString());
    }

    @Test
    void aFileWhoseBodiesFailKeepsItsDeclarationsAndLosesOnlyItsBodyFacts() throws IOException {
        CodeModelFile model = parse(SOURCES, failing(SourceEngine.Pass.BODIES, "A.java"));

        List<String> ids = ids(model);
        assertTrue(ids.contains("M:p.A#a()"), ids.toString());
        assertTrue(invokes(model, "M:p.A#a()").isEmpty(), model.edges().toString());
        assertEquals(List.of("M:java.lang.Integer#parseInt(java.lang.String)"),
                invokes(model, "M:p.B#b()").stream().map(call -> call.to().value()).toList());
        assertEquals(DiagnosticSeverity.WARNING, only(model, Diagnostics.FILE_NOT_PARSED).severity());
    }

    @Test
    void anExpressionThousandsOfTermsDeepIsParsedFromAThreadWithASmallStack() throws Exception {
        StringBuilder sum = new StringBuilder("x");
        for (int i = 0; i < 20_000; i++) sum.append(" + x");
        Map<String, String> sources = Map.of("p/Deep.java", "package p;\npublic class Deep {\n    int f(int x) { return Integer.valueOf(" + sum + "); }\n}\n");
        AtomicReference<CodeModelFile> model = new AtomicReference<>();
        AtomicReference<Throwable> failure = new AtomicReference<>();
        // The build's own thread may have as little stack as this; the engine brings its own.
        Thread small = new Thread(null, () -> {
            try {
                model.set(parse(sources, (pass, unit) -> {}));
            } catch (Throwable e) {
                failure.set(e);
            }
        }, "small-stack", 256 * 1024);
        small.start();
        small.join();

        if (failure.get() != null) throw new AssertionError(failure.get());
        assertTrue(model.get().diagnostics().stream().noneMatch(d -> d.code().equals(Diagnostics.MODULE_NOT_PARSED) || d.code().equals(Diagnostics.FILE_NOT_PARSED)),
                model.get().diagnostics().toString());
        assertEquals(List.of("M:java.lang.Integer#valueOf(int)"), invokes(model.get(), "M:p.Deep#f(int)").stream().map(call -> call.to().value()).toList());
    }

    private static BiConsumer<SourceEngine.Pass, CompilationUnitTree> failing(SourceEngine.Pass failingPass, String fileName) {
        return (pass, unit) -> {
            if (pass == failingPass && unit.getSourceFile().getName().endsWith(fileName)) throw new IllegalStateException("walker bug");
        };
    }

    private CodeModelFile parse(Map<String, String> files, BiConsumer<SourceEngine.Pass, CompilationUnitTree> beforeWalk) throws IOException {
        Path sources = root.resolve("src");
        for (Map.Entry<String, String> file : files.entrySet()) {
            Path path = sources.resolve(file.getKey());
            Files.createDirectories(path.getParent());
            Files.writeString(path, file.getValue(), StandardCharsets.UTF_8);
        }
        ArtifactInput input = new ArtifactInput("p", "failure", "1", root, null, List.of(sources), root.resolve("classes"), List.of(), 17,
                StandardCharsets.UTF_8, "jar", null);
        ParseRequest request = new ParseRequest(root, "failure", "", "", root.resolve("out"), EngineKind.SOURCE, List.of(input));
        return new SourceEngine(beforeWalk).parse(input, new ParseSession(new Generator("noesis-parse-java", "1.0.0"), request));
    }

    private static List<String> ids(CodeModelFile model) {
        return model.nodes().stream().map(node -> node.id().value()).toList();
    }

    private static List<Edge.Invokes> invokes(CodeModelFile model, String from) {
        return model.edges().stream().filter(Edge.Invokes.class::isInstance).map(Edge.Invokes.class::cast).filter(call -> call.from().value().equals(from)).toList();
    }

    private static Diagnostic only(CodeModelFile model, String code) {
        List<Diagnostic> found = model.diagnostics().stream().filter(d -> d.code().equals(code)).toList();
        assertEquals(1, found.size(), model.diagnostics().toString());
        return found.get(0);
    }
}
