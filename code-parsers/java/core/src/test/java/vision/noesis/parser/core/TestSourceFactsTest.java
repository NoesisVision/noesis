package vision.noesis.parser.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static vision.noesis.parser.core.Models.SYNTAX;

import java.util.List;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import vision.noesis.parser.model.Annotation;
import vision.noesis.parser.model.AnnotationValue;
import vision.noesis.parser.model.CodeModelFile;
import vision.noesis.parser.model.MethodNode;

/** The test sources are in the module's own model: Cucumber step definitions, their expressions and the calls they make. */
class TestSourceFactsTest {

    private static final String STEPS = SYNTAX + "steps.ProgramSteps";
    private static final String WHEN = "T:io.cucumber.java.en.When";

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void aTestSourceIsATypeOfTheModuleLocatedUnderTheTestRoot(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        String file = Models.type(model, STEPS).locations().get(0).file();
        assertEquals("code-parsers/java/test-fixtures/java-syntax/src/test/java/vision/noesis/fixture/syntax/steps/ProgramSteps.java", file);
        assertFalse(Models.has(Models.other(engine), "T:" + STEPS));
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void aStepDefinitionCarriesItsExpressionAsTheAnnotationsValue(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        MethodNode step = Models.method(model, STEPS + "#thePlainClassIsPrinted(int)");
        assertEquals("\"the plain class is printed {int} times\"", Models.literal(Models.annotation(step.annotations(), WHEN), "value"));
        MethodNode regex = Models.method(model, STEPS + "#theTextIsPrinted()");
        assertEquals("\"^the text is (?:printed|shown)$\"", Models.literal(Models.annotation(regex.annotations(), "T:io.cucumber.java.en.Then"), "value"));
        assertEquals("A:io.cucumber:cucumber-java@" + System.getProperty("noesis.version.cucumber"), Models.stub(model, WHEN).artifact().value());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void repeatedStepAnnotationsAreTheirContainer(EngineKind engine) {
        MethodNode step = Models.method(Models.syntax(engine), STEPS + "#thePlainClassIsPrintedOnce()");
        Annotation container = Models.annotation(step.annotations(), WHEN + "+Whens");
        List<AnnotationValue> repeats = ((AnnotationValue.Array) Models.argument(container, "value").value()).items();
        assertEquals(List.of("\"the plain class is printed\"", "\"the plain class is shown\""),
                repeats.stream().map(repeat -> Models.literal(((AnnotationValue.Nested) repeat).annotation(), "value")).toList());
    }

    @ParameterizedTest
    @EnumSource(EngineKind.class)
    void aStepDefinitionInvokesTheMainSources(EngineKind engine) {
        CodeModelFile model = Models.syntax(engine);
        assertEquals(1, Models.invokesTo(model, "M:" + STEPS + "#thePlainClassIsPrinted(int)", "M:" + SYNTAX + "types.ClassKinds+PlainClass#.ctor()").size());
    }
}
