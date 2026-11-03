using CSharpSyntax.Projection.Behaviors;
using Reqnroll;

// Reqnroll step definitions the steps of behavior-forms.feature bind to; the class itself is no block.
namespace CSharpSyntax.Projection.Rules;

[Binding]
public class BehaviorSteps
{
    private readonly BehaviorForms _forms = new();

    [Given("a behavior form")]
    public void GivenABehaviorForm() { }

    [When("the overloaded behavior runs with {int}")]
    public void WhenTheOverloadedBehaviorRuns(int first) => _forms.Overloaded(first);

    [When("the named behavior runs")]
    public void WhenTheNamedBehaviorRuns() => _forms.NamedByAnnotation();

    [Then("nothing is returned")]
    public void ThenNothingIsReturned() { }
}
