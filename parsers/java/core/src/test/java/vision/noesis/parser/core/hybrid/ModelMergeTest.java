package vision.noesis.parser.core.hybrid;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.source.tree.CompilationUnitTree;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import javax.tools.JavaCompiler;
import javax.tools.ToolProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vision.noesis.parser.core.ArtifactInput;
import vision.noesis.parser.core.ArtifactNodes;
import vision.noesis.parser.core.ClasspathEntry;
import vision.noesis.parser.core.Diagnostics;
import vision.noesis.parser.core.Engine;
import vision.noesis.parser.core.EngineKind;
import vision.noesis.parser.core.Fixtures;
import vision.noesis.parser.core.JavaParser;
import vision.noesis.parser.core.ParseRequest;
import vision.noesis.parser.core.ParseSession;
import vision.noesis.parser.core.bytecode.BytecodeEngine;
import vision.noesis.parser.core.java.JavaIds;
import vision.noesis.parser.core.source.SourceEngine;
import vision.noesis.parser.model.ArtifactDependency;
import vision.noesis.parser.model.ArtifactKind;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.DeclarationNode;
import vision.noesis.parser.model.Diagnostic;
import vision.noesis.parser.model.DiagnosticSeverity;
import vision.noesis.parser.model.Edge;
import vision.noesis.parser.model.MethodNode;
import vision.noesis.parser.model.Modifier;
import vision.noesis.parser.model.Origin;
import vision.noesis.parser.model.TypeNode;
import vision.noesis.parser.model.TypeRef;

/**
 * The merge on inputs the fixtures do not have: one of the engines failed on the module or on a file, the class files
 * are missing or stale, and Lombok features whose output the source model contradicts. Each case compiles its own
 * sources, with Lombok as the annotation processor, into a temporary module.
 */
class ModelMergeTest {

    @TempDir
    Path root;

    @Test
    void aSourceEngineThatFailedLeavesTheBytecodeModelAsItIsWithTheFailure() {
        CodeModelFile bytecode = Fixtures.lombok(EngineKind.BYTECODE).model("java-lombok");
        CodeModelFile failed = CodeModelFile.sorted(bytecode.generator(), bytecode.artifact(), List.of(), List.of(), List.of(),
                List.of(Diagnostics.error(Diagnostics.MODULE_NOT_PARSED, "Module java-lombok could not be parsed: boom")));
        ParseSession session = new ParseSession(new JavaParser(Fixtures.GENERATOR_VERSION).generator(), Fixtures.lombokRequest(EngineKind.HYBRID));

        CodeModelFile merged = ModelMerge.merge(failed, bytecode, bytecode.artifact(), session);

        assertEquals(bytecode.nodes(), merged.nodes(), "nodes as bytecode has them: none relabelled as generated");
        assertTrue(merged.nodes().stream().map(DeclarationNode::origin).noneMatch(origin -> origin == Origin.GENERATED));
        assertEquals(bytecode.edges().size(), merged.edges().size());
        assertTrue(merged.diagnostics().stream().anyMatch(d -> d.code().equals(Diagnostics.MODULE_NOT_PARSED)), merged.diagnostics().toString());
    }

    @Test
    void aBytecodeEngineThatFailedLeavesTheSourceModelWithAWarningNotAFailure() throws Exception {
        ArtifactInput input = module(Map.of("p/A.java", "package p;\npublic class A { public int a() { return 1; } }\n"));
        CodeModelFile source = parse(input, new SourceEngine());
        CodeModelFile failed = CodeModelFile.sorted(source.generator(), source.artifact(), List.of(), List.of(), List.of(),
                List.of(Diagnostics.error(Diagnostics.MODULE_NOT_PARSED, "Module m could not be parsed: boom")));

        CodeModelFile merged = merge(input, source, failed);

        assertEquals(source.nodes(), merged.nodes());
        assertEquals(source.edges(), merged.edges());
        assertTrue(merged.diagnostics().stream().noneMatch(d -> d.code().equals(Diagnostics.MODULE_NOT_PARSED)), merged.diagnostics().toString());
        Diagnostic unavailable = only(merged, Diagnostics.BYTECODE_UNAVAILABLE);
        assertEquals(DiagnosticSeverity.WARNING, unavailable.severity());
        assertTrue(unavailable.message().contains("boom"), unavailable.message());
    }

    @Test
    void theTypesOfAFileTheSourceEngineDroppedAreTakenFromBytecodeAsDeclared() throws Exception {
        ArtifactInput input = module(Map.of(
                "p/A.java", "package p;\npublic class A {\n    public int a() { return new B().b(); }\n}\n",
                "p/B.java", "package p;\npublic class B {\n    public int b() { return Integer.parseInt(\"1\"); }\n}\n"));
        CodeModelFile source = parse(input, failing("DECLARATIONS", "B.java"));
        assertEquals(DiagnosticSeverity.ERROR, only(source, Diagnostics.FILE_NOT_PARSED).severity(), "the source engine dropped B.java");

        CodeModelFile merged = merge(input, source, parse(input, new BytecodeEngine()));

        for (String id : List.of("T:p.B", "M:p.B#b()")) {
            DeclarationNode node = node(merged, id);
            assertEquals(Origin.DECLARED, node.origin(), id + " is written in the sources, not generated");
            assertEquals("bytecode", node.languageSpecific().get(ModelMerge.ENGINE_KEY), id);
        }
        assertEquals(1, invokes(merged, "M:p.B#b()", "M:java.lang.Integer#parseInt(java.lang.String)").size());
        Diagnostic failure = only(merged, Diagnostics.FILE_NOT_PARSED);
        assertEquals(DiagnosticSeverity.WARNING, failure.severity(), "the file is in the model: " + failure.message());
        assertFalse(failure.message().contains("missing from the model"), failure.message());
        assertEquals("src/p/B.java", failure.location().file());
    }

    @Test
    void aMethodLombokMadeStaticTakesTheClassFilesModifiersInOrder() throws Exception {
        ArtifactInput input = module(Map.of("p/U.java", "package p;\n@lombok.experimental.UtilityClass\npublic class U {\n    public int twice(int x) { return 2 * x; }\n}\n"));

        CodeModelFile merged = merge(input);

        MethodNode twice = (MethodNode) node(merged, "M:p.U#twice(int)");
        assertEquals(List.of(Modifier.STATIC), twice.modifiers(), "static, no longer virtual");
        assertEquals(true, twice.languageSpecific().get(ModelMerge.PROCESSOR_MODIFIED_KEY));
        assertEquals(List.of(Modifier.FINAL), ((TypeNode) node(merged, "T:p.U")).modifiers());
    }

    @Test
    void anUnresolvedBaseStaysUnlessBytecodeHasABaseOfTheSameKind() throws Exception {
        Path classes = root.resolve("classes");
        compile(Map.of(
                "p/Base.java", "package p;\npublic class Base {}\n",
                "p/D.java", "package p;\npublic class D implements Runnable { public void run() {} }\n",
                "p/E.java", "package p;\npublic class E extends Base {}\n"), root.resolve("stale"), classes);
        // The sources moved on from the classes: C has no class file, D's and E's are older than their sources.
        ArtifactInput input = input(write(root.resolve("src"), Map.of(
                "p/Base.java", "package p;\npublic class Base {}\n",
                "p/C.java", "package p;\npublic class C implements Gone {}\n",
                "p/D.java", "package p;\npublic class D implements Gone {}\n",
                "p/E.java", "package p;\npublic class E extends Base implements Gone {}\n")), classes);

        CodeModelFile merged = merge(input);

        assertEquals(List.of("<unresolved:Gone>"), bases(merged, "T:p.C", Edge.Implements.class), "no class file to replace it");
        assertEquals(List.of("java.lang.Runnable"), bases(merged, "T:p.D", Edge.Implements.class), "replaced by the class file's");
        assertEquals(List.of("<unresolved:Gone>"), bases(merged, "T:p.E", Edge.Implements.class), "the class file has a base, but no interface to replace it with");
        assertEquals(List.of("p.Base"), bases(merged, "T:p.E", Edge.Extends.class));
    }

    @Test
    void theInitializerOfAGeneratedStaticFieldIsTheFields() throws Exception {
        ArtifactInput input = module(Map.of("p/S.java", "package p;\n@lombok.extern.java.Log\npublic class S {\n    public void run() {}\n}\n"));

        CodeModelFile merged = merge(input);

        DeclarationNode log = node(merged, "F:p.S.log");
        assertEquals(Origin.GENERATED, log.origin());
        assertEquals(1, invokes(merged, "F:p.S.log", "M:java.util.logging.Logger#getLogger(java.lang.String)").size(), merged.edges().toString());
        assertTrue(merged.nodes().stream().noneMatch(n -> n.id().value().equals("M:p.S#.cctor()")), "the initializer is the field's");
        assertTrue(merged.edges().stream().noneMatch(e -> e instanceof Edge.Accesses a && a.from().value().equals("F:p.S.log") && a.to().value().equals("F:p.S.log")),
                "the initializer's store into its own field is no access");
    }

    @Test
    void theInitializersOfSeveralGeneratedStaticFieldsAreToldApartByTheirLines() throws Exception {
        ArtifactInput input = module(Map.of("p/S.java", "package p;\n@lombok.extern.java.Log\npublic class S {\n    @lombok.Synchronized\n    public static void run() {}\n}\n"));

        CodeModelFile merged = merge(input);

        assertEquals(Origin.GENERATED, node(merged, "F:p.S.$LOCK").origin());
        assertEquals(1, invokes(merged, "F:p.S.log", "M:java.util.logging.Logger#getLogger(java.lang.String)").size(), merged.edges().toString());
        assertTrue(merged.nodes().stream().noneMatch(n -> n.id().value().equals("M:p.S#.cctor()")), "the initializers are the fields'");
    }

    @Test
    void theInitializersOfGeneratedStaticFieldsOnOneLineStayOnAGeneratedStaticInitializer() throws Exception {
        ArtifactInput input = module(Map.of("p/S.java", "package p;\n@lombok.extern.java.Log public class S { @lombok.Synchronized public static void run() {} }\n"));

        CodeModelFile merged = merge(input);

        assertTrue(merged.nodes().stream().anyMatch(n -> n.id().value().equals("F:p.S.$LOCK")), merged.nodes().toString());
        DeclarationNode initializer = node(merged, "M:p.S#.cctor()");
        assertEquals(Origin.GENERATED, initializer.origin());
        assertEquals(1, invokes(merged, "M:p.S#.cctor()", "M:java.util.logging.Logger#getLogger(java.lang.String)").size(), merged.edges().toString());
    }

    @Test
    void missingClassFilesLeaveTheSourceModelWithAWarningNotAnError() throws Exception {
        Path src = write(root.resolve("src"), Map.of("p/A.java", "package p;\npublic class A { public int a() { return 1; } }\n"));
        ArtifactInput input = input(src, root.resolve("classes"));
        CodeModelFile source = parse(input, new SourceEngine());

        CodeModelFile merged = merge(input, source, parse(input, new BytecodeEngine()));

        assertEquals(source.nodes(), merged.nodes());
        Diagnostic missing = only(merged, Diagnostics.CLASSES_MISSING);
        assertEquals(DiagnosticSeverity.WARNING, missing.severity(), missing.message());
        assertTrue(missing.message().contains("source model"), missing.message());
    }

    @Test
    void theBodiesOfAFileTheSourceEngineFailedOnAreTakenFromBytecode() throws Exception {
        ArtifactInput input = module(Map.of(
                "p/A.java", "package p;\n@lombok.Builder\npublic class A {\n    int x;\n}\n",
                "p/B.java", "package p;\npublic class B {\n    private final String s = String.valueOf(1);\n"
                        + "    public int b() { return Integer.parseInt(s); }\n"
                        + "    public int c(A.ABuilder builder) { return builder.hashCode(); }\n}\n"));
        CodeModelFile source = parse(input, failing("BODIES", "B.java"));
        assertEquals(DiagnosticSeverity.WARNING, only(source, Diagnostics.FILE_NOT_PARSED).severity(), "the source engine dropped B.java's bodies");

        CodeModelFile merged = merge(input, source, parse(input, new BytecodeEngine()));

        List<Edge.Invokes> parse = invokes(merged, "M:p.B#b()", "M:java.lang.Integer#parseInt(java.lang.String)");
        assertEquals(1, parse.size(), merged.edges().toString());
        assertEquals("bytecode", parse.get(0).site().languageSpecific().get(ModelMerge.ENGINE_KEY));
        assertEquals(1, invokes(merged, "F:p.B.s", "M:java.lang.String#valueOf(int)").size(), "the field initializer is the field's");
        assertEquals(1, invokes(merged, "M:p.B#c(p.A+ABuilder)", "M:java.lang.Object#hashCode()").size(), "from the repaired id");
        assertEquals(1, invokes(merged, "M:p.B#.ctor()", "M:java.lang.Object#.ctor()").size(), merged.edges().toString());
        assertTrue(merged.edges().stream().noneMatch(e -> e instanceof Edge.Accesses a && a.to().value().equals("F:p.B.s") && a.from().value().contains("#.ctor(")),
                "the initializer's store is no access");
        Diagnostic failure = only(merged, Diagnostics.FILE_NOT_PARSED);
        assertEquals(DiagnosticSeverity.WARNING, failure.severity());
        assertTrue(failure.message().contains("taken from the class files"), failure.message());
    }

    @Test
    void theInitializerOfAGeneratedInstanceFieldIsTheFieldsNotTheConstructors() throws Exception {
        ArtifactInput input = module(Map.of("p/L.java", "package p;\npublic class L {\n    private final int n;\n    public L() { n = 1; }\n    public L(int n) { this.n = n; }\n"
                + "    @lombok.Synchronized\n    public void run() { System.out.println(n); }\n}\n"));

        CodeModelFile merged = merge(input);

        assertEquals(Origin.GENERATED, node(merged, "F:p.L.$lock").origin());
        assertTrue(merged.edges().stream().noneMatch(e -> e instanceof Edge.Accesses a && a.to().value().equals("F:p.L.$lock") && a.from().value().contains("#.ctor(")),
                "no constructor writes the lock: " + merged.edges());
        assertTrue(merged.edges().stream().noneMatch(e -> e.from().value().equals("F:p.L.$lock") && e instanceof Edge.Accesses), "the store into its own field is no access");
        assertEquals(1, merged.edges().stream().filter(e -> e instanceof Edge.Accesses a && a.from().value().equals("M:p.L#run()") && a.to().value().equals("F:p.L.$lock")).count(),
                "the synchronized method reads it");
    }

    @Test
    void anEnumsCompilerMadeStaticInitializerIsNotItsLoggersInitializer() throws Exception {
        ArtifactInput input = module(Map.of("p/E.java", "package p;\n@lombok.extern.java.Log\npublic enum E {\n    A, B;\n    public void run() { log.info(\"x\"); }\n}\n"));

        CodeModelFile merged = merge(input);

        assertEquals(List.of("M:java.lang.Class`1#getName()", "M:java.util.logging.Logger#getLogger(java.lang.String)"), targetsFrom(merged, "F:p.E.log"));
        assertTrue(merged.nodes().stream().noneMatch(n -> n.id().value().equals("M:p.E#.cctor()")));
    }

    @Test
    void theAssertionSwitchIsNotTheLoggersInitializer() throws Exception {
        ArtifactInput input = module(Map.of("p/S.java", "package p;\n@lombok.extern.java.Log\npublic class S {\n    public void run(int x) { assert x > 0; }\n}\n"));

        CodeModelFile merged = merge(input);

        assertEquals(List.of("M:java.lang.Class`1#getName()", "M:java.util.logging.Logger#getLogger(java.lang.String)"), targetsFrom(merged, "F:p.S.log"));
        assertTrue(merged.nodes().stream().noneMatch(n -> n.id().value().equals("M:p.S#.cctor()")));
    }

    // --- A module of its own ------------------------------------------------------------------------------------------

    private ArtifactInput module(Map<String, String> sources) throws IOException {
        Path src = write(root.resolve("src"), sources);
        Path classes = root.resolve("classes");
        compile(sources, src, classes);
        return input(src, classes);
    }

    private static Path write(Path dir, Map<String, String> sources) throws IOException {
        for (Map.Entry<String, String> file : sources.entrySet()) {
            Path path = dir.resolve(file.getKey());
            Files.createDirectories(path.getParent());
            Files.writeString(path, file.getValue(), StandardCharsets.UTF_8);
        }
        return dir;
    }

    /** javac with Lombok as the processor, the way the fixture's build compiles. */
    private static void compile(Map<String, String> sources, Path src, Path classes) throws IOException {
        write(src, sources);
        Files.createDirectories(classes);
        List<String> arguments = new ArrayList<>(List.of("--release", "17", "-g", "-parameters", "-cp", lombok().toString(), "-processorpath", lombok().toString(), "-d", classes.toString()));
        for (String file : sources.keySet()) arguments.add(src.resolve(file).toString());
        JavaCompiler javac = ToolProvider.getSystemJavaCompiler();
        assertEquals(0, javac.run(null, null, null, arguments.toArray(new String[0])), "the module compiles");
    }

    private static Path lombok() {
        return Path.of(System.getProperty("noesis.classpath.lombok"));
    }

    private ArtifactInput input(Path src, Path classes) {
        ClasspathEntry lombok = new ClasspathEntry(lombok(), new ArtifactDependency(JavaIds.libraryArtifact("org.projectlombok:lombok", "1"), ArtifactKind.LIBRARY, null));
        return new ArtifactInput("p", "m", "1", root, null, List.of(src), classes, List.of(lombok), 17, StandardCharsets.UTF_8, "jar", null);
    }

    private ParseSession session(ArtifactInput input) {
        ParseRequest request = new ParseRequest(root, "m", "", "", root.resolve("out"), EngineKind.HYBRID, List.of(input));
        return new ParseSession(new JavaParser(Fixtures.GENERATOR_VERSION).generator(), request);
    }

    private CodeModelFile parse(ArtifactInput input, Engine engine) {
        return engine.parse(input, session(input));
    }

    private CodeModelFile merge(ArtifactInput input) {
        return merge(input, parse(input, new SourceEngine()), parse(input, new BytecodeEngine()));
    }

    private CodeModelFile merge(ArtifactInput input, CodeModelFile source, CodeModelFile bytecode) {
        ParseSession session = session(input);
        return ModelMerge.merge(source, bytecode, ArtifactNodes.of(input, session, input.id(), EngineKind.HYBRID), session);
    }

    /** The source engine with a walker that fails on one pass ({@code DECLARATIONS}, {@code BODIES}) over one file, as {@code SourceEngineFailureTest} provokes {@code NS1010}. */
    private static SourceEngine failing(String failingPass, String fileName) throws ReflectiveOperationException {
        BiConsumer<Object, CompilationUnitTree> beforeWalk = (pass, unit) -> {
            if (pass.toString().equals(failingPass) && unit.getSourceFile().getName().endsWith(fileName)) throw new IllegalStateException("walker bug");
        };
        Constructor<SourceEngine> constructor = SourceEngine.class.getDeclaredConstructor(BiConsumer.class);
        constructor.setAccessible(true);
        return constructor.newInstance(beforeWalk);
    }

    // --- Queries -----------------------------------------------------------------------------------------------------

    private static DeclarationNode node(CodeModelFile model, String id) {
        return model.nodes().stream().filter(n -> n.id().value().equals(id)).findFirst()
                .orElseThrow(() -> new AssertionError("No node " + id + " in " + model.nodes().stream().map(n -> n.id().value()).toList()));
    }

    private static List<Edge.Invokes> invokes(CodeModelFile model, String from, String to) {
        return model.edges().stream().filter(Edge.Invokes.class::isInstance).map(Edge.Invokes.class::cast)
                .filter(call -> call.from().value().equals(from) && call.to().value().equals(to)).toList();
    }

    /** What the declaration's body edges reach, sorted. */
    private static List<String> targetsFrom(CodeModelFile model, String from) {
        return model.edges().stream().filter(e -> e.from().value().equals(from)).map(e -> {
            if (e instanceof Edge.Invokes call) return call.to().value();
            if (e instanceof Edge.Accesses access) return access.to().value();
            return e instanceof Edge.UsesType use ? use.to().canonical() : null;
        }).filter(target -> target != null).sorted().toList();
    }

    private static List<String> bases(CodeModelFile model, String from, Class<? extends Edge> kind) {
        return model.edges().stream().filter(kind::isInstance).filter(e -> e.from().value().equals(from))
                .map(e -> e instanceof Edge.Extends x ? x.to() : ((Edge.Implements) e).to()).map(TypeRef::canonical).toList();
    }

    private static Diagnostic only(CodeModelFile model, String code) {
        List<Diagnostic> found = model.diagnostics().stream().filter(d -> d.code().equals(code)).toList();
        assertEquals(1, found.size(), model.diagnostics().toString());
        return found.get(0);
    }
}
