package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static vision.noesis.parser.core.Models.SYNTAX;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import vision.noesis.parser.model.Annotation;
import vision.noesis.parser.model.AnnotationValue;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.NamespaceNode;
import vision.noesis.parser.model.Origin;
import vision.noesis.parser.model.SourceSpan;

/** Packages as namespaces: the root, every dotted level, their locations, annotations and the package both modules declare. */
class NamespaceFactsTest {

    private static final String FIXTURE = "vision.noesis.fixture";
    private static final String DEEP = SYNTAX + "imports.dotted.deeply.nested";
    private static final String SOURCES = "parsers/java/test-fixtures/java-syntax/src/main/java/vision/noesis/fixture/";

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void theRootNamespaceIsContainedByTheArtifact(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        NamespaceNode root = Models.namespace(model, "");
        assertEquals("", root.name());
        assertEquals(Origin.DECLARED, root.origin());
        assertTrue(root.locations().isEmpty());
        assertTrue(Models.contains(model, "A:java-syntax", "N:"));
        assertTrue(Models.contains(model, "N:", "N:vision"));
        assertFalse(Models.contains(model, "N:", "N:vision.noesis"));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void everyLevelOfADottedPackageIsANode(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        List<String> levels = List.of("vision", "vision.noesis", FIXTURE, FIXTURE + ".syntax", SYNTAX + "imports", SYNTAX + "imports.dotted", SYNTAX + "imports.dotted.deeply", DEEP);
        for (int i = 0; i < levels.size(); i++) {
            NamespaceNode node = Models.namespace(model, levels.get(i));
            assertEquals(levels.get(i).substring(levels.get(i).lastIndexOf('.') + 1), node.name());
            assertEquals(Origin.DECLARED, node.origin());
            if (i > 0) assertTrue(Models.contains(model, "N:" + levels.get(i - 1), "N:" + levels.get(i)), levels.get(i));
        }
        assertTrue(Models.contains(model, "N:" + DEEP, "T:" + DEEP + ".ClassInDeeplyNestedPackage"));
        assertTrue(Models.contains(model, "N:" + SYNTAX + "imports", "T:" + SYNTAX + "imports.Types"));
        assertTrue(Models.contains(model, "N:" + SYNTAX + "imports", "T:" + SYNTAX + "imports.ImportForms"));
        assertTrue(Models.contains(model, "N:" + SYNTAX + "imports", "N:" + SYNTAX + "imports.nested"));
        assertTrue(Models.contains(model, "N:" + FIXTURE + ".syntax", "T:" + SYNTAX + "Program"));
        assertFalse(Models.contains(model, "N:" + FIXTURE, "T:" + SYNTAX + "Program"));
    }

    @Test
    void namespaceLocationsAreThePackageClausesRepositoryRelativeWithForwardSlashes() {
        CodeModelFile model = Models.syntax(EngineKind.SOURCE);
        SourceSpan dotted = Models.one(Models.namespace(model, SYNTAX + "imports.dotted").locations(), span -> true, "location of the dotted package");
        assertEquals(SOURCES + "syntax/imports/dotted/deeply/nested/ClassInDeeplyNestedPackage.java", dotted.file());
        assertEquals(new SourceSpan(dotted.file(), 1, 9, 1, 52), dotted);
        assertEquals(new SourceSpan(dotted.file(), 1, 9, 1, 66), Models.namespace(model, DEEP).locations().get(0));
        List<SourceSpan> syntax = Models.namespace(model, FIXTURE + ".syntax").locations();
        Models.one(syntax, span -> span.file().equals(SOURCES + "syntax/Program.java") && span.startLine() == 1 && span.startColumn() == 9, "Program.java package clause");
        Models.one(syntax, span -> span.file().equals(SOURCES + "syntax/package-info.java") && span.startLine() == 3, "package-info.java package clause");
        assertTrue(syntax.size() > 30);
        assertTrue(Models.namespace(model, "vision").locations().size() >= syntax.size());
        assertTrue(syntax.stream().noneMatch(span -> span.file().contains("\\")));
        assertEquals(syntax.stream().sorted().toList(), syntax);
    }

    @Test
    void bytecodeNamespacesHaveNoLocations() {
        CodeModelFile model = Models.syntax(EngineKind.BYTECODE);
        assertTrue(model.nodes().stream().filter(NamespaceNode.class::isInstance).allMatch(node -> node.locations().isEmpty()));
        assertTrue(model.nodes().stream().anyMatch(NamespaceNode.class::isInstance));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void packageAnnotationsLandOnTheNamespaceUnlikeInCSharp(EngineKind engine) {
        NamespaceNode syntax = Models.namespace(Models.syntax(engine), FIXTURE + ".syntax");
        Annotation module = Models.one(syntax.annotations(), annotation -> true, "package annotation");
        assertEquals("vision.noesis.annotations.Module", module.type().canonical());
        assertEquals("value", module.arguments().get(0).name());
        assertEquals("\"syntax\"", ((AnnotationValue.Literal) module.arguments().get(0).value()).text());
        assertTrue(syntax.languageSpecific().isEmpty());
        assertEquals(engine != EngineKind.BYTECODE ? "The syntax fixture: one file per topic the parser maps." : null, syntax.documentation());
        assertTrue(Models.namespace(Models.syntax(engine), FIXTURE).annotations().isEmpty());
        NamespaceNode other = Models.namespace(Models.other(engine), FIXTURE + ".other");
        assertEquals("\"other\"", ((AnnotationValue.Literal) other.annotations().get(0).arguments().get(0).value()).text());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void aPackageDeclaredInBothModulesAppearsInEachWithItsOwnTypes(EngineKind engine) {
        CodeModelFile syntax = Models.syntax(engine);
        CodeModelFile other = Models.other(engine);
        assertTrue(Models.contains(syntax, "N:" + FIXTURE + ".shared", "T:" + FIXTURE + ".shared.SharedNamespaceInSyntax"));
        assertFalse(Models.has(syntax, "T:" + FIXTURE + ".shared.SharedNamespaceInOtherModule"));
        assertTrue(Models.contains(other, "N:" + FIXTURE + ".shared", "T:" + FIXTURE + ".shared.SharedNamespaceInOtherModule"));
        assertFalse(Models.has(other, "T:" + FIXTURE + ".shared.SharedNamespaceInSyntax"));
        assertFalse(Models.hasStub(syntax, "T:" + FIXTURE + ".shared.SharedNamespaceInOtherModule"));
        assertFalse(Models.hasStub(syntax, "N:" + FIXTURE + ".shared"));
        assertEquals("shared", Models.namespace(other, FIXTURE + ".shared").name());
        assertFalse(Models.has(syntax, "N:" + FIXTURE + ".other"));
    }
}
