namespace CSharpSyntax.Inheritance;

public record BaseRecord(int Value);

public record DerivedRecord(int Value, string Extra) : BaseRecord(Value);

public sealed record SealedDerivedRecord(int Value) : DerivedRecord(Value, "");

public abstract record AbstractBaseRecord
{
    public abstract int AbstractPropertyInRecord { get; }

    public virtual string VirtualMethodInRecord() => nameof(AbstractBaseRecord);
}

public record ConcreteRecordFromAbstract : AbstractBaseRecord
{
    public override int AbstractPropertyInRecord => 1;

    public override string VirtualMethodInRecord() => base.VirtualMethodInRecord();
}

public record RecordWithPrimaryConstructorCallingBaseWithExpression(int Value) : BaseRecord(Value * 2);

public record GenericBaseRecord<T>(T Value);

public record DerivedFromGenericRecord(string Value) : GenericBaseRecord<string>(Value);

public record DerivedFromOpenGenericRecord<T>(T Value, int Extra) : GenericBaseRecord<T>(Value);

public record RecordDerivedFromRecordWithBodyOnly : BaseRecord
{
    public RecordDerivedFromRecordWithBodyOnly() : base(0) { }
}
