namespace CSharpSyntax.Types;

public record PositionalRecord(int First, string Second);

public record RecordWithBodyOnly
{
    public int InitOnlyProperty { get; init; }
}

public record class ExplicitRecordClass(int Value);

public record struct PositionalRecordStruct(int First, string Second);

public readonly record struct ReadonlyRecordStruct(int Value);

public record struct RecordStructWithBodyOnly
{
    public int MutableProperty { get; set; }
}

public sealed record SealedRecord(int Value);

public abstract record AbstractRecord(int Value);

public partial record PartialRecord(int Value);

public partial record PartialRecord
{
    public int DoubledValue => Value * 2;
}

public record RecordWithPositionalAndBodyMembers(int Positional)
{
    public int NonPositional { get; init; }

    public int Computed => Positional + NonPositional;

    public RecordWithPositionalAndBodyMembers(int positional, int nonPositional) : this(positional)
    {
        NonPositional = nonPositional;
    }
}

public record RecordWithExplicitToString(int Value)
{
    public override string ToString() => $"{nameof(RecordWithExplicitToString)}({Value})";
}

public record GenericRecord<T>(T Value);

public record struct GenericRecordStruct<TFirst, TSecond>(TFirst First, TSecond Second);

public partial record struct PartialRecordStruct(int Value);

public partial record struct PartialRecordStruct
{
    public int DoubledValue => Value * 2;
}

internal record InternalRecord;

public record RecordWithPositionalFieldAttribute([property: Obsolete] int Value);
