using CSharpSyntax.Projection.Blocks;
using NoesisVision.Annotations;
using NoesisVision.Annotations.Domain;
using NoesisVision.Annotations.People;
using NoesisVision.Annotations.Domain.DDD;

// Methods that become (or do not become) behaviors, with every input and output form.
namespace CSharpSyntax.Projection.Behaviors;

[DddDomainService]
public class BehaviorForms
{
    [Actor("Customer")]
    public void WithActor() { }

    [EntryPoint(TriggeredBy = TriggeredBy.Query)]
    public ValueObjectBlock EntryPointQuery() => new(Guid.Empty);

    [EntryPoint(TriggeredBy = TriggeredBy.Command)]
    public void EntryPointCommand() { }

    /// <summary>Named by its annotation.</summary>
    [DomainBehavior("Named behavior")]
    [Scenario("Behavior scenario")]
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

    public static BehaviorForms StaticFactory() => new();

    [ExcludeFromDocs]
    public void ExcludedIsNoBehavior() { }

    public override string ToString() => nameof(BehaviorForms);

    public override bool Equals(object? obj) => ReferenceEquals(this, obj);

    public override int GetHashCode() => 0;

    internal void InternalIsNoBehavior() { }

    protected void ProtectedIsNoBehavior() { }

    private void PrivateIsNoBehavior() { }

    public static BehaviorForms operator +(BehaviorForms left, BehaviorForms right) => left;
}

/// <summary>A behavior annotation on a type that is no block has no home.</summary>
public static class TypeThatIsNoBlock
{
    [DomainBehavior("Lost")]
    public static void BehaviorWithoutHome() { }
}
