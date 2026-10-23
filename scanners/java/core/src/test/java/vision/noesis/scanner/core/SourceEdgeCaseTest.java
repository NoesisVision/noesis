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
import org.junit.jupiter.api.condition.EnabledForJreRange;
import org.junit.jupiter.api.condition.JRE;
import org.junit.jupiter.api.io.TempDir;
import vision.noesis.scanner.core.java.JavaIds;
import vision.noesis.scanner.model.ArtifactDependency;
import vision.noesis.scanner.model.ArtifactKind;
import vision.noesis.scanner.model.CodeModelFile;
import vision.noesis.scanner.model.Diagnostic;
import vision.noesis.scanner.model.DiagnosticSeverity;
import vision.noesis.scanner.model.Edge;
import vision.noesis.scanner.model.PackageReference;
import vision.noesis.scanner.model.TypeUseRole;

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

    // --- Patterns (Java 21): a type pattern, a record pattern and its nested patterns are type tests --------------------

    private static final String SHAPES = """
            package p;
            sealed interface Shape permits Circle, Square, Box {}
            record Circle(double r) implements Shape {}
            record Square(double side) implements Shape {}
            record Box(Shape content) implements Shape {}
            """;

    @Test
    @EnabledForJreRange(min = JRE.JAVA_21)
    void typePatternsOfASwitchAreTypeTests() throws IOException {
        CodeModelFile model = scan(21, SHAPES + """
                class C {
                    double area(Shape s) {
                        return switch (s) {
                            case Circle c -> c.r();
                            case Square q -> q.side();
                            case Box b -> 0;
                        };
                    }
                }
                """);

        assertScanned(model);
        assertEquals(List.of("p.Box", "p.Circle", "p.Square"), typeTests(model, "M:p.C#area(p.Shape)"));
    }

    @Test
    @EnabledForJreRange(min = JRE.JAVA_21)
    void aRecordPatternTestsItsRecordAndItsNestedTypePatternsButNotVarOrPrimitives() throws IOException {
        CodeModelFile model = scan(21, SHAPES + """
                class C {
                    double size(Object o) {
                        if (o instanceof Circle(double r)) return r;
                        if (o instanceof Box(Circle c)) return c.r();
                        return switch (o) {
                            case Square(var side) when side > 0 -> side;
                            default -> 0;
                        };
                    }
                }
                """);

        assertScanned(model);
        assertEquals(List.of("p.Box", "p.Circle", "p.Circle", "p.Square"), typeTests(model, "M:p.C#size(java.lang.Object)"));
    }

    @Test
    @EnabledForJreRange(min = JRE.JAVA_21)
    void aPlainInstanceofPatternIsOneTypeTest() throws IOException {
        CodeModelFile model = scan(21, """
                package p;
                class C {
                    int f(Object o) { return o instanceof String s ? s.length() : 0; }
                }
                """);

        assertEquals(List.of("java.lang.String"), typeTests(model, "M:p.C#f(java.lang.Object)"));
    }

    // --- Modules ------------------------------------------------------------------------------------------------------

    @Test
    void aModuleInfoDoesNotCutTheSourcesOffTheirClasspath() throws IOException {
        Files.createDirectories(root.resolve("src"));
        Files.writeString(root.resolve("src/module-info.java"), "module edge { requires com.google.common; }", StandardCharsets.UTF_8);
        ArtifactDependency guava = new ArtifactDependency(JavaIds.libraryArtifact("com.google.guava:guava", "1"), ArtifactKind.LIBRARY, new PackageReference("com.google.guava:guava", "1"));
        CodeModelFile model = scan(17, List.of(new ClasspathEntry(Path.of(System.getProperty("noesis.classpath.guava")), guava)), """
                package p;
                import com.google.common.base.Strings;
                public class C {
                    String f(String s) { return Strings.nullToEmpty(s); }
                }
                """);

        assertScanned(model);
        assertTrue(invokes(model, "M:p.C#f(java.lang.String)").stream().anyMatch(call -> call.to().value().equals("M:com.google.common.base.Strings#nullToEmpty(java.lang.String)")),
                model.diagnostics().toString());
    }

    private static List<String> typeTests(CodeModelFile model, String from) {
        return model.edges().stream().filter(Edge.UsesType.class::isInstance).map(Edge.UsesType.class::cast)
                .filter(use -> use.from().value().equals(from) && use.role() == TypeUseRole.TYPE_TEST).map(use -> use.to().canonical()).sorted().toList();
    }

    private CodeModelFile scan(int release, String source) throws IOException {
        return scan(release, List.of(), source);
    }

    private CodeModelFile scan(int release, List<ClasspathEntry> classpath, String source) throws IOException {
        Path sources = root.resolve("src");
        Path file = sources.resolve("p/C.java");
        Files.createDirectories(file.getParent());
        Files.writeString(file, source, StandardCharsets.UTF_8);
        ArtifactInput input = new ArtifactInput("p", "edge", "1", root, null, List.of(sources), root.resolve("classes"), classpath, release,
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
