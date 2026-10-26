using NoesisVision.Annotations;
using NoesisVision.Annotations.Domain;
using NoesisVision.Annotations.Domain.DDD;

// Types the projection turns into building blocks, one per annotation, plus the
// member forms that become (or do not become) properties.
namespace CSharpSyntax.Projection.Blocks;

/// <summary>Doc comment shadowed by the ShortDescription.</summary>
[DddAggregate]
[ShortDescription("An aggregate with a *short* description.")]
[Scenario("Aggregate scenario")]
public class AggregateBlock
{
    private readonly List<EntityBlock> _entities = new();
    public const int ConstantIsNoProperty = 1;
    public static int StaticIsNoProperty;
    public event Action? EventIsNoProperty;

    /// <summary>A collection, backed by a field of the same name.</summary>
    public IReadOnlyList<EntityBlock> Entities => _entities;

    public ValueObjectBlock? OptionalValueObject { get; private set; }

    public DateTime? OptionalPrimitive { get; private set; }

    public EnumBlock Enum { get; private set; } = EnumBlock.First;

    public Dictionary<string, int> DictionaryHasNoWord { get; } = new();

    public UnannotatedInterface? UnannotatedTypeHasNoWord { get; set; }

    public int this[int index] => index;

    [ExcludeFromDocs]
    public string ExcludedProperty { get; set; } = "";

    internal int InternalIsNoProperty { get; set; }

    [DddRepository]
    public interface Repository
    {
        Task<AggregateBlock> GetBy(ValueObjectBlock id);

        Task Save(AggregateBlock aggregate);
    }

    [Event]
    public record NestedEvent(ValueObjectBlock Id);

    [DddEntity("Named nested entity")]
    public class NestedEntityNamedByAnnotation;
}

[DddEntity]
public class EntityBlock
{
    public ValueObjectBlock Value { get; } = new(Guid.Empty);
}

/// <summary>Deriving from a block gives no block without an annotation of its own.</summary>
public class DerivedFromBlockWithoutAnnotation : EntityBlock;

[DddValueObject]
public record ValueObjectBlock(Guid Value);

[DddValueObject]
public readonly record struct RecordStructBlock(int Value);

[DddValueObject]
public struct StructBlock
{
    public int Value;
}

/// <summary>The name override is no element name, so the code's name stands.</summary>
[DddValueObject("Blocks.Badly named")]
public record NameOverrideIsNoElementName(int Value);

/// <summary>An enum is a block without properties.</summary>
[DddValueObject]
public enum EnumBlock
{
    First,
    Second,
}

[Command]
public record CommandBlock(ValueObjectBlock Id, string? Note);

[Query]
public record QueryBlock(int Page);

[Event]
public record EventBlock(ValueObjectBlock Id);

[DddDomainEvent]
public record DomainEventBlock(ValueObjectBlock Id);

[ReadModel]
public record ReadModelBlock(ValueObjectBlock Id, string Name);

[DddDomainService]
public class DomainServiceBlock;

[DddApplicationService]
public class ApplicationServiceBlock;

[DddFactory]
public class FactoryBlock;

[ExternalSystemIntegration("Forex")]
public interface ExternalIntegrationBlock
{
    decimal RateFor(string currency);
}

/// <summary>A generic block; its type parameter resolves through the constraint.</summary>
[DddRepository]
public interface GenericRepositoryBlock<T> where T : AggregateBlock
{
    T Get(ValueObjectBlock id);
}

[DddEntity]
public abstract class AbstractBlock;

[DddEntity]
public class ImplementsBlocksAndOthers : AbstractBlock, ExternalIntegrationBlock, UnannotatedInterface
{
    public decimal RateFor(string currency) => 0m;
}

/// <summary>Not annotated: no block, so members typed with it have no word.</summary>
public interface UnannotatedInterface;

/// <summary>Annotated delegate: never a block.</summary>
[DddValueObject]
public delegate void DelegateIsNoBlock();
