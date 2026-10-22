package vision.noesis.scanner.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.Diagnostic;
import vision.noesis.scanner.model.DiagnosticSeverity;
import vision.noesis.scanner.model.Edge;

/**
 * Code shapes that once crashed the source engine or walked a body under the wrong member, each scanned as a module of
 * its own: one ordinary line of user code must not cost the scan of a module, let alone of every module.
 */
class SourceEdgeCaseTest {

    @TempDir
    Path root;

    @Test
    void aSelfBoundedWildcardCaptureDoesNotRecurseForever() throws IOException {
        CodeModelFile model = scan(17, """
                package p;
                import java.util.*;
                public class C {
                    int f(Enum<?> e) {
                        var l = Collections.singletonList(e);
                        return Collections.singletonList(e).size() + l.size();
                    }
                }
                """);

        assertScanned(model);
        List<Edge.Invokes> calls = model.edges().stream().filter(Edge.Invokes.class::isInstance).map(Edge.Invokes.class::cast)
                .filter(call -> call.from().value().startsWith("M:p.C#f(")).toList();
        assertTrue(calls.stream().anyMatch(call -> call.to().value().equals("M:java.util.Collections#singletonList`1(!!0)")), calls.toString());
        assertTrue(calls.stream().filter(call -> call.to().value().startsWith("M:java.util.Collections#singletonList"))
                .allMatch(call -> call.typeArguments().get(0).canonical().startsWith("java.lang.Enum`1[")), calls.toString());
    }

    @Test
    void aClassInsideAnInstanceInitializerDoesNotStopTheWalkOfTheNextInitializer() throws IOException {
        CodeModelFile model = scan(17, """
                package p;
                public class C {
                    { Runnable r = new Runnable() { public void run() {} }; }
                    { int x = 1; }
                }
                """);

        assertScanned(model);
        assertTrue(model.nodes().stream().anyMatch(node -> node.id().value().equals("T:p.C+1")), model.nodes().toString());
    }

    @Test
    void aDoubleBraceInitializerBelongsToTheAnonymousClassNotToTheOuterConstructor() throws IOException {
        CodeModelFile model = scan(17, """
                package p;
                import java.util.*;
                public class C {
                    Map<String, Integer> m;
                    { m = new HashMap<>() {{ put("a", 1); }}; }
                }
                """);

        assertScanned(model);
        List<Edge.Invokes> puts = model.edges().stream().filter(Edge.Invokes.class::isInstance).map(Edge.Invokes.class::cast)
                .filter(call -> call.to().value().startsWith("M:java.util.HashMap`2#put(")).toList();
        assertEquals(List.of("M:p.C+1#.ctor()"), puts.stream().map(call -> call.from().value()).toList());
    }

    @Test
    void aClassInAnInitializerIsWalkedOnceHoweverManyConstructorsRunTheInitializer() throws IOException {
        CodeModelFile model = scan(17, """
                package p;
                public class C {
                    static void target() {}
                    { new Runnable() { public void run() { target(); } }.run(); }
                    public C() {}
                    public C(int x) {}
                }
                """);

        assertScanned(model);
        assertEquals(1, invokes(model, "M:p.C+1#run()").stream().filter(call -> call.to().value().equals("M:p.C#target()")).count());
        for (String constructor : List.of("M:p.C#.ctor()", "M:p.C#.ctor(int)")) {
            assertEquals(1, invokes(model, constructor).stream().filter(call -> call.to().value().equals("M:p.C+1#.ctor()")).count(), constructor);
        }
    }

    @Test
    void aReleaseNewerThanTheRunningJdkIsBoundAgainstTheRunningJdkWithAWarning() throws IOException {
        int running = Runtime.version().feature();
        CodeModelFile model = scan(running + 1, """
                package p;
                public class C {
                    String f() { return String.valueOf(1); }
                }
                """);

        assertScanned(model);
        Diagnostic warning = model.diagnostics().stream().filter(d -> d.code().equals(Diagnostics.RELEASE_NOT_SUPPORTED)).findFirst()
                .orElseThrow(() -> new AssertionError(model.diagnostics().toString()));
        assertEquals(DiagnosticSeverity.WARNING, warning.severity());
        assertTrue(warning.message().contains("bound against release " + running), warning.message());
        assertTrue(invokes(model, "M:p.C#f()").stream().anyMatch(call -> call.to().value().equals("M:java.lang.String#valueOf(int)")));
    }

    @Test
    void aReleaseOlderThanJavacSupportsIsBoundAgainstTheOldestItDoes() throws IOException {
        CodeModelFile model = scan(6, """
                package p;
                public class C {}
                """);

        assertScanned(model);
        assertTrue(model.diagnostics().stream().anyMatch(d -> d.code().equals(Diagnostics.RELEASE_NOT_SUPPORTED) && d.message().startsWith("Release 6 ")),
                model.diagnostics().toString());
    }

    private CodeModelFile scan(int release, String source) throws IOException {
        Path sources = root.resolve("src");
        Path file = sources.resolve("p/C.java");
        Files.createDirectories(file.getParent());
        Files.writeString(file, source, StandardCharsets.UTF_8);
        ArtifactInput input = new ArtifactInput("p", "edge", "1", root, null, List.of(sources), root.resolve("classes"), List.of(), release,
                StandardCharsets.UTF_8, "jar", null);
        ScanRequest request = new ScanRequest(root, "edge", "", "", root.resolve("out"), EngineKind.SOURCE, List.of(input));
        return JavaScanner.engineFor(EngineKind.SOURCE).scan(input, new ScanSession(new JavaScanner(Fixtures.GENERATOR_VERSION).generator(), request));
    }

    private static void assertScanned(CodeModelFile model) {
        List<String> failures = model.diagnostics().stream().filter(d -> d.code().equals(Diagnostics.MODULE_NOT_SCANNED)).map(Diagnostic::message).collect(Collectors.toList());
        assertTrue(failures.isEmpty(), failures.toString());
        assertTrue(!model.nodes().isEmpty(), "no nodes");
    }

    private static List<Edge.Invokes> invokes(CodeModelFile model, String from) {
        return model.edges().stream().filter(Edge.Invokes.class::isInstance).map(Edge.Invokes.class::cast).filter(call -> call.from().value().equals(from)).toList();
    }
}
