using CSharpSyntax.OtherProject.Projection;
using CSharpSyntax.Projection.ExcludedNamespace;
using NoesisVision.Annotations.Domain;
using NoesisVision.Annotations.Domain.DDD;

// Chains from a behaviour through methods that are no behaviour: private steps, a generic
// step, a cycle, an excluded namespace, the other project, async, lambdas, local
// functions; and the forms that end or never start a chain.
namespace CSharpSyntax.Projection.Invocations;

[DddApplicationService]
public class CallChains
{
    private readonly int _fromFieldInitializer = Reached.ByFieldInitializer();
    private readonly Action _callback = Reached.ByDelegate;

    public void ThreeStepsDeep() => StepOne();

    private void StepOne() => StepTwo();

    private void StepTwo() => StepThree();

    private static void StepThree() => Reached.ByThreeSteps();

    public void ThroughGenericStep() => GenericStep(new ModifierA()).Modify();

    private static T GenericStep<T>(T value)
    {
        Reached.ByGenericStep();
        return value;
    }

    public void ThroughCycle() => CycleOne();

    private void CycleOne() => CycleTwo();

    private void CycleTwo()
    {
        CycleOne();
        Reached.ByCycle();
    }

    public void ThroughExcludedNamespace() => ExcludedBlock.StepThroughExcluded();

    public void ThroughOtherProject() => StepFromOtherProject.Forward();

    public async Task ThroughAwaitedStep() => await StepAsync();

    private static async Task StepAsync()
    {
        await Task.Yield();
        Reached.ByAwaitedStep();
    }

    public void ThroughLambda()
    {
        var modifiers = new List<ModifierA> { default };
        modifiers.ForEach(modifier => modifier.Modify());
        _ = modifiers.Select(modifier =>
        {
            Reached.ByLambda();
            return modifier;
        }).ToList();
    }

    public void ThroughLocalFunction()
    {
        Local();
        return;

        static void Local() => Reached.ByLocalFunction();
    }

    /// <summary>A constructor ends the walk.</summary>
    public void ThroughConstructor() => _ = new ConstructedInChain();

    public void CallsOwnOverload() => CallsOwnOverload(1);

    public void CallsOwnOverload(int value) => Reached.ByOverload();

    public void MutualA() => MutualB();

    public void MutualB() => MutualA();

    public void ThroughDelegateField() => _callback();

    public void ThroughOperator()
    {
        var block = new OperatorBlock(1);
        _ = block + block;
    }

    public int PropertyCallingBehaviour
    {
        get
        {
            Reached.ByPropertyGetter();
            return _fromFieldInitializer;
        }
    }

    public void CallsPrivateBehaviour() => PrivateBehaviour();

    [DomainBehavior("Private behaviour")]
    private void PrivateBehaviour() => Reached.ByPrivateBehaviour();
}

public class ConstructedInChain
{
    public ConstructedInChain() => Reached.ByConstructor();
}

[DddValueObject]
public record OperatorBlock(int Value)
{
    public OperatorBlock Add(OperatorBlock other)
    {
        Reached.ByOperatorBody();
        return this;
    }

    public static OperatorBlock operator +(OperatorBlock left, OperatorBlock right) => left.Add(right);
}
