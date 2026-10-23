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
        assertTrue(model.diagnostics().stream().anyMatch(d -> d.source() == DiagnosticSource.COMPILER && d.severity() == DiagnosticSeverity.ERROR && d.code().startsWith("compiler.err.")),
                model.diagnostics().toString());
        assertTrue(model.diagnostics().stream().anyMatch(d -> d.code().equals(Diagnostics.UNBOUND_SITE)), model.diagnostics().toString());
        for (Diagnostic diagnostic : model.diagnostics()) {
            if (diagnostic.location() != null) assertEquals(true, diagnostic.location().file().startsWith("parsers/java/core/src/test/resources/fixtures-broken/"), diagnostic.location().file());
        }
    }

    private static DeclarationNode node(String id) {
        return model.nodes().stream().filter(node -> node.id().equals(new NodeId(id))).findFirst().orElseThrow(() -> new AssertionError("No node " + id));
    }
}
