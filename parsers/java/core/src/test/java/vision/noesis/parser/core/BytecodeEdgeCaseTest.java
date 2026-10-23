package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import javax.tools.JavaCompiler;
import javax.tools.ToolProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.Edge;

/** Class directories the fixtures do not have, compiled here and read by the bytecode engine as a module of their own. */
class BytecodeEdgeCaseTest {

    @TempDir
    Path root;

    /**
     * A multi-release module keeps a second {@code A/K.class} under {@code META-INF/versions/17}. The package sorts
     * before {@code META-INF}, so a reader that took both would end on the versioned copy and its extra method.
     */
    @Test
    void aMultiReleaseModuleIsReadFromItsBaseClasses() throws IOException {
        Path classes = root.resolve("classes");
        compile(11, write(Map.of("A/K.java", "package A;\npublic class K { public void base() {} }\n")), classes);
        compile(17, write(Map.of("A/K.java", "package A;\npublic class K { public void base() {} public void onlyIn17() {} }\n")), classes.resolve("META-INF/versions/17"));

        CodeModelFile model = parse(EngineKind.BYTECODE, 17, null, classes);

        List<String> methods = model.nodes().stream().map(node -> node.id().value()).filter(id -> id.startsWith("M:A.K#")).sorted().toList();
        assertEquals(List.of("M:A.K#.ctor()", "M:A.K#base()"), methods);
    }

    /** {@code C#m(String)} overrides {@code B<String>#m(T)} through its bridge; the nearer superclass wins over {@code A#m(String)}. */
    @Test
    void anOverrideThroughABridgeBindsTheNearestSuperclassMethod() throws IOException {
        List<String> overrides = assertAgrees(17, Map.of(
                "p/A.java", "package p;\npublic class A { public void m(String s) {} }\n",
                "p/B.java", "package p;\npublic class B<T> extends A { public void m(T t) {} }\n",
                "p/C.java", "package p;\npublic class C extends B<String> { public void m(String s) {} }\n"), Edge.Overrides.class);

        assertEquals(List.of("M:p.C#m(java.lang.String) -> M:p.B`1#m(!0)"), overrides);
    }

    /** A package-private method is not inherited into another package, so nothing there overrides it. */
    @Test
    void aMethodOfAnotherPackageDoesNotOverrideAPackagePrivateOne() throws IOException {
        List<String> overrides = assertAgrees(17, Map.of(
                "a/A.java", "package a;\npublic class A { void pkg() {} protected void prot() {} }\n",
                "b/B.java", "package b;\npublic class B extends a.A { void pkg() {} protected void prot() {} }\n"), Edge.Overrides.class);

        assertEquals(List.of("M:b.B#prot() -> M:a.A#prot()"), overrides);
    }

    /** A superclass method the class does not inherit, private or package-private elsewhere, fills no interface slot. */
    @Test
    void aMethodTheClassDoesNotInheritImplementsNoInterfaceMember() throws IOException {
        List<String> implementations = assertAgrees(17, Map.of(
                "q/Base.java", "package q;\npublic class Base { private void m() {} void n() {} public void o() {} }\n",
                "p/I.java", "package p;\npublic interface I { void m(); void n(); void o(); }\n",
                "p/D.java", "package p;\npublic abstract class D extends q.Base implements I {}\n"), Edge.ImplementsMember.class);

        assertEquals(List.of("M:q.Base#o() -> M:p.I#o()"), implementations);
    }

    /**
     * Before nestmates (release 10 and older) {@code new Nested()} on a private constructor compiles to a call of a
     * synthetic access constructor that takes an extra {@code Outer$1}; the call is to the constructor the source names.
     */
    @Test
    void aCallOfAPrivateNestedConstructorBindsTheDeclaredConstructorBeforeNestmates() throws IOException {
        Models models = parseBoth(8, Map.of(
                "p/Outer.java", """
                        package p;
                        public class Outer {
                            private static class Nested { private Nested() {} private Nested(int i) {} }
                            Object make() { return new Nested(); }
                            Object make(int i) { return new Nested(i); }
                            enum E { A { } }
                        }
                        """));

        List<String> calls = edges(models.bytecode(), Edge.Invokes.class).stream().filter(call -> call.startsWith("M:p.Outer#make")).toList();
        assertEquals(List.of("M:p.Outer#make() -> M:p.Outer+Nested#.ctor()", "M:p.Outer#make(int) -> M:p.Outer+Nested#.ctor(int)"), calls);
        AgreementRules rules = new AgreementRules(List.of(models.source()));
        rules.compare(models.source(), models.bytecode());
        // At release 8 the source engine names no artifact for platform stubs; the bytecode engine says java.base@8.
        assertEquals(List.of(), rules.differences().stream().filter(difference -> !difference.contains("stub differs")).toList());
    }

    /** Parses the sources with both engines, asserts they agree, and returns the bytecode model's edges of a kind. */
    private List<String> assertAgrees(int release, Map<String, String> files, Class<? extends Edge> kind) throws IOException {
        Models models = parseBoth(release, files);
        AgreementRules rules = new AgreementRules(List.of(models.source()));
        rules.compare(models.source(), models.bytecode());
        assertEquals(List.of(), rules.differences());
        return edges(models.bytecode(), kind);
    }

    private record Models(CodeModelFile source, CodeModelFile bytecode) {}

    private Models parseBoth(int release, Map<String, String> files) throws IOException {
        Path sources = write(files);
        Path classes = root.resolve("classes");
        compile(release, sources, classes);
        return new Models(parse(EngineKind.SOURCE, release, sources, classes), parse(EngineKind.BYTECODE, release, sources, classes));
    }

    private static List<String> edges(CodeModelFile model, Class<? extends Edge> kind) {
        return model.edges().stream().filter(kind::isInstance).map(edge -> edge.from().value() + " -> " + target(edge)).sorted().toList();
    }

    private static String target(Edge edge) {
        if (edge instanceof Edge.Overrides overrides) return overrides.to().value();
        if (edge instanceof Edge.ImplementsMember implementation) return implementation.to().value();
        return ((Edge.Invokes) edge).to().value();
    }

    private Path write(Map<String, String> files) throws IOException {
        Path sources = Files.createTempDirectory(root, "src");
        for (Map.Entry<String, String> entry : files.entrySet()) {
            Path file = sources.resolve(entry.getKey());
            Files.createDirectories(file.getParent());
            Files.writeString(file, entry.getValue(), StandardCharsets.UTF_8);
        }
        return sources;
    }

    private void compile(int release, Path sources, Path output) throws IOException {
        Files.createDirectories(output);
        List<String> arguments = new ArrayList<>(List.of("--release", Integer.toString(release), "-parameters", "-nowarn", "-Xlint:-options", "-d", output.toString()));
        try (Stream<Path> files = Files.walk(sources)) {
            files.filter(file -> file.toString().endsWith(".java")).sorted().forEach(file -> arguments.add(file.toString()));
        }
        JavaCompiler javac = ToolProvider.getSystemJavaCompiler();
        assertEquals(0, javac.run(null, null, null, arguments.toArray(String[]::new)));
    }

    private CodeModelFile parse(EngineKind engine, int release, Path sources, Path classes) {
        ArtifactInput input = new ArtifactInput("p", "edge", "1", root, null, sources == null ? List.of() : List.of(sources), classes, List.of(), release,
                StandardCharsets.UTF_8, "jar", null);
        ParseRequest request = new ParseRequest(root, "edge", "", "", root.resolve("out"), engine, List.of(input));
        return JavaParser.engineFor(engine).parse(input, new ParseSession(new JavaParser(Fixtures.GENERATOR_VERSION).generator(), request));
    }
}
