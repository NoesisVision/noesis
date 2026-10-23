package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.DeclarationNode;
import vision.noesis.parser.model.Diagnostic;
import vision.noesis.parser.model.DiagnosticSeverity;
import vision.noesis.parser.model.DiagnosticSource;
import vision.noesis.parser.model.FieldNode;
import vision.noesis.parser.model.NodeId;
import vision.noesis.parser.model.TypeRef;

/** Code that does not compile still yields a model: the declarations, unresolved references and the compiler's errors. */
class BrokenFixtureTest {

    private static CodeModelFile model;

    @BeforeAll
    static void parse() {
        Path root = Fixtures.MODULE_DIR.resolve("src/test/resources/fixtures-broken");
        ArtifactInput broken = new ArtifactInput("vision.noesis.fixtures", "broken", "0.1.0-SNAPSHOT", root, null,
                List.of(root.resolve("src/main/java")), root.resolve("target/classes"), List.of(), 17, StandardCharsets.UTF_8, "jar", null);
        ParseRequest request = new ParseRequest(Fixtures.REPOSITORY_ROOT, Fixtures.REPOSITORY_NAME, Fixtures.REVISION, "parsers/java/core/src/test/resources/fixtures-broken",
                Fixtures.MODULE_DIR.resolve("target/fixture-parse/broken"), EngineKind.SOURCE, List.of(broken));
        model = new JavaParser(Fixtures.GENERATOR_VERSION).parse(request).model("broken");
    }

    @Test
    void declarationsSurviveTheErrors() {
        List<String> ids = model.nodes().stream().map(node -> node.id().value()).toList();
        assertTrue(ids.contains("T:broken.SyntaxError"), ids.toString());
        assertTrue(ids.contains("M:broken.SyntaxError#works()"), "the method before the syntax error: " + ids);
        assertTrue(ids.contains("T:broken.MissingReference"), ids.toString());
        assertTrue(ids.contains("M:broken.MissingReference#works()"), ids.toString());
    }

    @Test
    void anUnboundNameIsAnUnresolvedReference() {
        FieldNode field = (FieldNode) node("F:broken.MissingReference.unknown");
        assertTrue(field.type() instanceof TypeRef.Unresolved, field.type().toString());
    }

    @Test
    void theCompilerErrorsAreDiagnostics() {
        List<String> errors = model.diagnostics().stream().filter(d -> d.source() == DiagnosticSource.COMPILER && d.severity() == DiagnosticSeverity.ERROR)
                .map(BrokenFixtureTest::codeAt).sorted().toList();
        assertEquals(List.of(
                "compiler.err.cant.resolve.location MissingReference.java:7:19",
                "compiler.err.cant.resolve.location MissingReference.java:7:41",
                "compiler.err.doesnt.exist MissingReference.java:3:8",
                "compiler.err.illegal.start.of.type SyntaxError.java:9:24"), errors, model.diagnostics().toString());
        List<String> unbound = model.diagnostics().stream().filter(d -> d.code().equals(Diagnostics.UNBOUND_SITE)).map(BrokenFixtureTest::codeAt).sorted().toList();
        assertEquals(List.of("NS1002 MissingReference.java:10:16", "NS1002 MissingReference.java:7:37"), unbound, "new Unknown() and unknown.describe()");
        assertEquals(6, model.diagnostics().size(), model.diagnostics().toString());
        for (Diagnostic diagnostic : model.diagnostics()) {
            if (diagnostic.location() != null) assertEquals(true, diagnostic.location().file().startsWith("parsers/java/core/src/test/resources/fixtures-broken/"), diagnostic.location().file());
        }
    }

    /** The code and where it is, as {@code code File.java:line:column}. */
    private static String codeAt(Diagnostic diagnostic) {
        String file = diagnostic.location().file();
        return diagnostic.code() + " " + file.substring(file.lastIndexOf('/') + 1) + ":" + diagnostic.location().startLine() + ":" + diagnostic.location().startColumn();
    }

    private static DeclarationNode node(String id) {
        return model.nodes().stream().filter(node -> node.id().equals(new NodeId(id))).findFirst().orElseThrow(() -> new AssertionError("No node " + id));
    }
}
