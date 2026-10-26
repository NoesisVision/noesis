using CSharpSyntax.Projection.Blocks;
using NoesisVision.Annotations;
using NoesisVision.Annotations.Domain;
using NoesisVision.Annotations.People;
using NoesisVision.Annotations.Domain.DDD;

// Methods that become (or do not become) behaviours, with every input and output form.
namespace CSharpSyntax.Projection.Behaviours;

[DddDomainService]
public class BehaviourForms
{
    [Actor("Customer")]
    public void WithActor() { }

    [EntryPoint(TriggeredBy = TriggeredBy.Query)]
    public ValueObjectBlock EntryPointQuery() => new(Guid.Empty);

    [EntryPoint(TriggeredBy = TriggeredBy.Command)]
    public void EntryPointCommand() { }

    /// <summary>Named by its annotation.</summary>
    [DomainBehavior("Named behaviour")]
    [Scenario("Behaviour scenario")]
    public void NamedByAnnotation() { }

    public void Overloaded(int first) => Overloaded(first, 0);

    public void Overloaded(int first, int second) { }

    public Task<ValueObjectBlock> TaskOutputUnwrapped() => Task.FromResult(new ValueObjectBlock(Guid.Empty));

    public Task TaskOutputIsVoid() => Task.CompletedTask;

    public IEnumerable<ValueObjectBlock> CollectionOutput() => [];

    public ValueObjectBlock[] ArrayOutput() => [];

    public ValueObjectBlock? OptionalOutput() => null;

    public void OptionalInputs(ValueObjectBlock? nullable, int withDefault = 0) { }

    public void InputWithoutWord(UnannotatedInterface unannotated, Dictionary<string, int> dictionary) { }

    public static BehaviourForms StaticFactory() => new();

    [ExcludeFromDocs]
    public void ExcludedIsNoBehaviour() { }

    public override string ToString() => nameof(BehaviourForms);

    public override bool Equals(object? obj) => ReferenceEquals(this, obj);

    public override int GetHashCode() => 0;

    internal void InternalIsNoBehaviour() { }

    protected void ProtectedIsNoBehaviour() { }

    private void PrivateIsNoBehaviour() { }

    public static BehaviourForms operator +(BehaviourForms left, BehaviourForms right) => left;
}

/// <summary>A behaviour annotation on a type that is no block has no home.</summary>
public static class TypeThatIsNoBlock
{
    [DomainBehavior("Lost")]
    public static void BehaviourWithoutHome() { }
}
