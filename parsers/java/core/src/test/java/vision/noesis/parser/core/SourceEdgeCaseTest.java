package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;
import javax.tools.JavaCompiler;
import javax.tools.ToolProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledForJreRange;
import org.junit.jupiter.api.condition.JRE;
import org.junit.jupiter.api.io.TempDir;
import vision.noesis.parser.core.java.JavaIds;
import vision.noesis.parser.model.ArtifactDependency;
import vision.noesis.parser.model.ArtifactKind;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.Diagnostic;
import vision.noesis.parser.model.DiagnosticSeverity;
import vision.noesis.parser.model.DiagnosticSource;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.PackageReference;
import vision.noesis.parser.model.SourceSpan;
import vision.noesis.parser.model.TypeRef;
import vision.noesis.parser.model.TypeUseRole;

/**
 * Code shapes that once crashed the source engine or walked a body under the wrong member, each parsed as a module of
 * its own: one ordinary line of user code must not cost the parse of a module, let alone of every module.
 */
class SourceEdgeCaseTest {

    @TempDir
    Path root;

    @Test
    void aSelfBoundedWildcardCaptureDoesNotRecurseForever() throws IOException {
        CodeModelFile model = parse(17, """
                package p;
                import java.util.*;
                public class C {
                    int f(Enum<?> e) {
                        var l = Collections.singletonList(e);
                        return Collections.singletonList(e).size() + l.size();
                    }
                }
                """);

        assertParsed(model);
        List<Edge.Invokes> calls = model.edges().stream().filter(Edge.Invokes.class::isInstance).map(Edge.Invokes.class::cast)
                .filter(call -> call.from().value().startsWith("M:p.C#f(")).toList();
        assertTrue(calls.stream().anyMatch(call -> call.to().value().equals("M:java.util.Collections#singletonList`1(!!0)")), calls.toString());
        assertTrue(calls.stream().filter(call -> call.to().value().startsWith("M:java.util.Collections#singletonList"))
                .allMatch(call -> call.typeArguments().get(0).canonical().startsWith("java.lang.Enum`1[")), calls.toString());
    }

    @Test
    void aClassInsideAnInstanceInitializerDoesNotStopTheWalkOfTheNextInitializer() throws IOException {
        CodeModelFile model = parse(17, """
                package p;
                public class C {
                    { Runnable r = new Runnable() { public void run() {} }; }
                    { int x = 1; }
                }
                """);

        assertParsed(model);
        assertTrue(model.nodes().stream().anyMatch(node -> node.id().value().equals("T:p.C+1")), model.nodes().toString());
    }

    @Test
    void aDoubleBraceInitializerBelongsToTheAnonymousClassNotToTheOuterConstructor() throws IOException {
        CodeModelFile model = parse(17, """
                package p;
                import java.util.*;
                public class C {
                    Map<String, Integer> m;
                    { m = new HashMap<>() {{ put("a", 1); }}; }
                }
                """);

        assertParsed(model);
        List<Edge.Invokes> puts = model.edges().stream().filter(Edge.Invokes.class::isInstance).map(Edge.Invokes.class::cast)
                .filter(call -> call.to().value().startsWith("M:java.util.HashMap`2#put(")).toList();
        assertEquals(List.of("M:p.C+1#.ctor()"), puts.stream().map(call -> call.from().value()).toList());
    }

    @Test
    void aClassInAnInitializerIsWalkedOnceHoweverManyConstructorsRunTheInitializer() throws IOException {
        CodeModelFile model = parse(17, """
                package p;
                public class C {
                    static void target() {}
                    { new Runnable() { public void run() { target(); } }.run(); }
                    public C() {}
                    public C(int x) {}
                }
                """);

        assertParsed(model);
        assertEquals(1, invokes(model, "M:p.C+1#run()").stream().filter(call -> call.to().value().equals("M:p.C#target()")).count());
        for (String constructor : List.of("M:p.C#.ctor()", "M:p.C#.ctor(int)")) {
            assertEquals(1, invokes(model, constructor).stream().filter(call -> call.to().value().equals("M:p.C+1#.ctor()")).count(), constructor);
        }
    }

    @Test
    void aReleaseNewerThanTheRunningJdkIsBoundAgainstTheRunningJdkWithAWarning() throws IOException {
        int running = Runtime.version().feature();
        CodeModelFile model = parse(running + 1, """
                package p;
                public class C {
                    String f() { return String.valueOf(1); }
                }
                """);

        assertParsed(model);
        Diagnostic warning = model.diagnostics().stream().filter(d -> d.code().equals(Diagnostics.RELEASE_NOT_SUPPORTED)).findFirst()
                .orElseThrow(() -> new AssertionError(model.diagnostics().toString()));
        assertEquals(DiagnosticSeverity.WARNING, warning.severity());
        assertTrue(warning.message().contains("bound against release " + running), warning.message());
        assertTrue(invokes(model, "M:p.C#f()").stream().anyMatch(call -> call.to().value().equals("M:java.lang.String#valueOf(int)")));
    }

    @Test
    void aReleaseOlderThanJavacSupportsIsBoundAgainstTheOldestItDoes() throws IOException {
        CodeModelFile model = parse(6, """
                package p;
                public class C {}
                """);

        assertParsed(model);
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
        CodeModelFile model = parse(21, SHAPES + """
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

        assertParsed(model);
        assertEquals(List.of("p.Box", "p.Circle", "p.Square"), typeTests(model, "M:p.C#area(p.Shape)"));
    }

    @Test
    @EnabledForJreRange(min = JRE.JAVA_21)
    void aRecordPatternTestsItsRecordAndItsNestedTypePatternsButNotVarOrPrimitives() throws IOException {
        CodeModelFile model = parse(21, SHAPES + """
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

        assertParsed(model);
        assertEquals(List.of("p.Box", "p.Circle", "p.Circle", "p.Square"), typeTests(model, "M:p.C#size(java.lang.Object)"));
    }

    @Test
    @EnabledForJreRange(min = JRE.JAVA_21)
    void aPlainInstanceofPatternIsOneTypeTest() throws IOException {
        CodeModelFile model = parse(21, """
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
        CodeModelFile model = parse(17, List.of(new ClasspathEntry(Path.of(System.getProperty("noesis.classpath.guava")), guava)), """
                package p;
                import com.google.common.base.Strings;
                public class C {
                    String f(String s) { return Strings.nullToEmpty(s); }
                }
                """);

        assertParsed(model);
        assertTrue(invokes(model, "M:p.C#f(java.lang.String)").stream().anyMatch(call -> call.to().value().equals("M:com.google.common.base.Strings#nullToEmpty(java.lang.String)")),
                model.diagnostics().toString());
    }

    // --- Columns, ids, inputs -----------------------------------------------------------------------------------------

    @Test
    void columnsCountCharactersNotTabStops() throws IOException {
        CodeModelFile model = parse(17, "package p;\npublic class C {\n\tint f() {\n\t\treturn missing;\n\t}\n}\n");

        SourceSpan method = model.nodes().stream().filter(node -> node.id().value().equals("M:p.C#f()")).findFirst().orElseThrow().locations().get(0);
        assertEquals(List.of(3, 2, 5, 3), List.of(method.startLine(), method.startColumn(), method.endLine(), method.endColumn()));
        SourceSpan error = model.diagnostics().stream().filter(d -> d.source() == DiagnosticSource.COMPILER).findFirst()
                .orElseThrow(() -> new AssertionError(model.diagnostics().toString())).location();
        assertEquals(List.of(4, 10, 4, 17), List.of(error.startLine(), error.startColumn(), error.endLine(), error.endColumn()));
    }

    @Test
    void overloadsThatDifferOnlyInATypeParameterBoundAreReportedNotDroppedSilently() throws IOException {
        CodeModelFile model = parse(17, """
                package p;
                public class C {
                    <T extends Number> void put(T v) {}
                    <T extends CharSequence> void put(T v) {}
                    void f() {
                        class Local { void g() {} }
                        new Runnable() { public void run() {} }.run();
                    }
                    { new Object() {}; }
                    public C() {}
                    public C(int x) {}
                }
                """);

        assertParsed(model);
        List<Diagnostic> duplicates = model.diagnostics().stream().filter(d -> d.code().equals(Diagnostics.DUPLICATE_ID)).toList();
        assertEquals(1, duplicates.size(), duplicates.toString());
        String message = duplicates.get(0).message();
        assertTrue(message.contains("M:p.C#put`1(!!0)") && message.contains("C.java:3") && message.contains("C.java:4"), message);
        assertEquals(4, duplicates.get(0).location().startLine());
    }

    /** javac gives a superclass it cannot bind an error type, as it does a missing interface; both are unresolved bases. */
    @Test
    void aSuperclassJavacCannotBindIsAnUnresolvedExtends() throws IOException {
        CodeModelFile model = parse(17, """
                package p;
                public class C extends Missing implements AlsoMissing {}
                """);

        assertParsed(model);
        List<TypeRef> extended = model.edges().stream().filter(Edge.Extends.class::isInstance).map(Edge.Extends.class::cast)
                .filter(edge -> edge.from().value().equals("T:p.C")).map(Edge.Extends::to).toList();
        List<TypeRef> implemented = model.edges().stream().filter(Edge.Implements.class::isInstance).map(Edge.Implements.class::cast)
                .filter(edge -> edge.from().value().equals("T:p.C")).map(Edge.Implements::to).toList();
        assertEquals(List.of(new TypeRef.Unresolved("Missing")), extended);
        assertEquals(List.of(new TypeRef.Unresolved("AlsoMissing")), implemented);
    }

    @Test
    void aSourceFileOnTheClasspathIsNotCompiledAsASource() throws IOException {
        Path lib = root.resolve("lib");
        Files.createDirectories(lib.resolve("lib"));
        Files.writeString(lib.resolve("lib/L.java"), "package lib;\npublic class L { public static void f() {} }\n", StandardCharsets.UTF_8);
        ArtifactDependency dependency = new ArtifactDependency(JavaIds.libraryArtifact("x:lib", "1"), ArtifactKind.LIBRARY, new PackageReference("x:lib", "1"));
        String caller = """
                package p;
                public class C {
                    void g() { lib.L.f(); }
                }
                """;

        CodeModelFile sourceOnly = parse(17, List.of(new ClasspathEntry(lib, dependency)), caller);
        assertParsed(sourceOnly);
        assertTrue(invokes(sourceOnly, "M:p.C#g()").isEmpty(), invokes(sourceOnly, "M:p.C#g()").toString());
        assertTrue(sourceOnly.diagnostics().stream().anyMatch(d -> d.source() == DiagnosticSource.COMPILER && d.severity() == DiagnosticSeverity.ERROR),
                sourceOnly.diagnostics().toString());

        JavaCompiler javac = ToolProvider.getSystemJavaCompiler();
        assertEquals(0, javac.run(null, null, null, "-d", lib.toString(), lib.resolve("lib/L.java").toString()));
        // A source newer than its class is the one javac would prefer, were it allowed to read it.
        Files.setLastModifiedTime(lib.resolve("lib/L.java"), FileTime.from(Instant.now().plusSeconds(60)));
        CodeModelFile withClass = parse(17, List.of(new ClasspathEntry(lib, dependency)), caller);
        assertParsed(withClass);
        assertEquals(List.of("M:lib.L#f()"), invokes(withClass, "M:p.C#g()").stream().map(call -> call.to().value()).toList());
        assertTrue(withClass.stubs().stream().anyMatch(stub -> stub.id().value().equals("M:lib.L#f()") && dependency.id().equals(stub.artifact())),
                withClass.stubs().toString());
    }

    @Test
    void symlinkedSourcesAreFollowedOnceAndALoopEndsTheWalk() throws IOException {
        Path real = root.resolve("real");
        Files.createDirectories(real.resolve("p"));
        Files.writeString(real.resolve("p/C.java"), "package p;\npublic class C { q.D d; }\n", StandardCharsets.UTF_8);
        Path linkedRoot = Files.createSymbolicLink(root.resolve("src"), real);
        Path other = root.resolve("other");
        Files.createDirectories(other);
        Files.writeString(other.resolve("D.java"), "package q;\npublic class D {}\n", StandardCharsets.UTF_8);
        Files.createSymbolicLink(real.resolve("q"), other);
        Files.createSymbolicLink(real.resolve("again"), real.resolve("p"));
        Files.createSymbolicLink(real.resolve("p/loop"), real);

        CodeModelFile model = parseRoots(17, List.of(linkedRoot), List.of());

        assertParsed(model);
        assertTrue(model.nodes().stream().anyMatch(node -> node.id().value().equals("T:p.C")), model.nodes().toString());
        assertTrue(model.nodes().stream().anyMatch(node -> node.id().value().equals("T:q.D")), model.nodes().toString());
        assertTrue(model.diagnostics().stream().noneMatch(d -> d.severity() == DiagnosticSeverity.ERROR), model.diagnostics().toString());
    }

    private static List<String> typeTests(CodeModelFile model, String from) {
        return model.edges().stream().filter(Edge.UsesType.class::isInstance).map(Edge.UsesType.class::cast)
                .filter(use -> use.from().value().equals(from) && use.role() == TypeUseRole.TYPE_TEST).map(use -> use.to().canonical()).sorted().toList();
    }

    private CodeModelFile parse(int release, String source) throws IOException {
        return parse(release, List.of(), source);
    }

    private CodeModelFile parse(int release, List<ClasspathEntry> classpath, String source) throws IOException {
        Path sources = root.resolve("src");
        Path file = sources.resolve("p/C.java");
        Files.createDirectories(file.getParent());
        Files.writeString(file, source, StandardCharsets.UTF_8);
        return parseRoots(release, List.of(sources), classpath);
    }

    private CodeModelFile parseRoots(int release, List<Path> sources, List<ClasspathEntry> classpath) {
        ArtifactInput input = new ArtifactInput("p", "edge", "1", root, null, sources, root.resolve("classes"), classpath, release,
                StandardCharsets.UTF_8, "jar", null);
        ParseRequest request = new ParseRequest(root, "edge", "", "", root.resolve("out"), EngineKind.SOURCE, List.of(input));
        return JavaParser.engineFor(EngineKind.SOURCE).parse(input, new ParseSession(new JavaParser(Fixtures.GENERATOR_VERSION).generator(), request));
    }

    private static void assertParsed(CodeModelFile model) {
        List<String> failures = model.diagnostics().stream().filter(d -> d.code().equals(Diagnostics.MODULE_NOT_PARSED)).map(Diagnostic::message).collect(Collectors.toList());
        assertTrue(failures.isEmpty(), failures.toString());
        assertTrue(!model.nodes().isEmpty(), "no nodes");
    }

    private static List<Edge.Invokes> invokes(CodeModelFile model, String from) {
        return model.edges().stream().filter(Edge.Invokes.class::isInstance).map(Edge.Invokes.class::cast).filter(call -> call.from().value().equals(from)).toList();
    }
}
