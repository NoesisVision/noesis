package vision.noesis.fixture.syntax.steps;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import vision.noesis.fixture.syntax.types.ClassKinds;

/** Cucumber step definitions in the test sources: in the module's own model, bound against the test classpath. */
public class ProgramSteps {

    private String text;

    @Given("a plain class")
    public void aPlainClass() {
    }

    @When("the plain class is printed {int} times")
    public void thePlainClassIsPrinted(int times) {
        text = new ClassKinds.PlainClass().toString().repeat(times);
    }

    @When("the plain class is printed")
    @When("the plain class is shown")
    public void thePlainClassIsPrintedOnce() {
        text = new ClassKinds.PlainClass().toString();
    }

    @Then("^the text is (?:printed|shown)$")
    public void theTextIsPrinted() {
    }
}
