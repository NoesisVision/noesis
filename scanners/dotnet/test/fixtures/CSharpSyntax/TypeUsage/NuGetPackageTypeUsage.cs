using JetBrains.Annotations;
using NodaTime;
using NodaTime.Text;
using NodaTime.TimeZones;

namespace CSharpSyntax.TypeUsage;

// Types from NuGet packages in every position a type can occupy. NodaTime supplies structs
// (`Instant`, `LocalDate`, `Duration`, `Offset`), classes (`DateTimeZone`, `Period`, `CalendarSystem`),
// interfaces (`IClock`, `IDateTimeZoneProvider`, `IPattern<T>`), an enum (`IsoDayOfWeek`) and
// operators; JetBrains.Annotations supplies attribute types. Mirrors `OwnProjectTypeUsage`.
[UsedImplicitly]
[BaseTypeRequired(typeof(IClock))]
public class NuGetPackageTypeUsage(IClock primaryConstructorParameter, Instant primaryConstructorStruct)
    : DateTimeZone("Fixture", true, Offset.Zero, Offset.Zero), IClock, IPattern<LocalDate>, IComparer<ZonedDateTime>
{
    // Fields.
    public DateTimeZone ClassField = DateTimeZone.Utc;
    public static DateTimeZone StaticClassField = DateTimeZone.Utc;
    public readonly Period ReadonlyClassField = Period.Zero;
    public const IsoDayOfWeek ConstEnumField = IsoDayOfWeek.Monday;
    public Instant StructField;
    public Instant? NullableStructField;
    public DateTimeZone? NullableClassField;
    public LocalDate[] ArrayField = [];
    public List<Instant> GenericCollectionField = [];
    public Dictionary<IsoDayOfWeek, List<LocalDate>> NestedGenericField = [];
    public (Instant Start, Duration Length) TupleField = (Instant.MinValue, Duration.Zero);
    public Func<Instant, LocalDate> FrameworkDelegateOfNuGetTypesField = static instant => instant.InUtc().Date;
    public IClock InterfaceField = SystemClock.Instance;
    public IPattern<LocalDate> GenericInterfaceField = LocalDatePattern.Iso;
    public IDateTimeZoneProvider ProviderField = DateTimeZoneProviders.Tzdb;
    public CalendarSystem StaticPropertyOfNuGetTypeField = CalendarSystem.Iso;
    public global::NodaTime.Offset FullyQualifiedField = Offset.Zero;
    public IClock PrimaryConstructorParameterField = primaryConstructorParameter;
    [CanBeNull] public Period? AttributedField;

    // Events.
    public event EventHandler<Instant>? EventWithNuGetArgs;
    public event Action<ZonedDateTime, Duration>? EventWithNuGetDelegateArguments;

    // Properties.
    public LocalDate AutoProperty { get; set; }
    public Instant InitProperty { get; init; }
    public required DateTimeZone RequiredProperty { get; set; }
    public Instant ExpressionBodiedProperty => primaryConstructorStruct;
    public LocalDate? NullableStructProperty { get; set; }
    public static Duration StaticProperty { get; set; } = Duration.FromHours(1);
    public IReadOnlyList<Instant> GenericInterfaceProperty { get; } = [];
    public ref Instant RefReturningProperty => ref StructField;
    [NotNull] public Period AttributedProperty { get; set; } = Period.Zero;

    // Indexers.
    public DateTimeZone this[IsoDayOfWeek key] => ClassField;
    public Duration this[Instant start, ZonedDateTime end] => end.ToInstant() - start;

    // Constructors. `DateTimeZone` requires its own base call.
    public NuGetPackageTypeUsage() : this(SystemClock.Instance, Instant.MinValue) { }

    public NuGetPackageTypeUsage(IClock clock, IsoDayOfWeek kind) : this(clock, Instant.MinValue) { }

    // Return types.
    public DateTimeZone ClassReturn() => ClassField;
    public Instant StructReturn() => StructField;
    public IsoDayOfWeek EnumReturn() => IsoDayOfWeek.Friday;
    public IClock InterfaceReturn() => this;
    public DateTimeZone? NullableClassReturn() => null;
    public Instant? NullableStructReturn() => null;
    public LocalDate[] ArrayReturn() => [];
    public List<Instant> GenericReturn() => [];
    public (Instant, IsoDayOfWeek) TupleReturn() => (StructField, IsoDayOfWeek.Monday);
    public async Task<Instant> AsyncReturn() => await Task.FromResult(StructField);
    public IEnumerable<LocalDate> IteratorReturn()
    {
        yield return AutoProperty;
    }
    public ref Instant RefReturn() => ref StructField;
    [Pure] public Duration AttributedPureReturn() => Duration.Zero;
    [ItemNotNull] public IEnumerable<Period> AttributedItemReturn() => [];

    // Parameters.
    public void ClassParameter(DateTimeZone value) { }
    public void StructParameter(Instant value) { }
    public void EnumParameter(IsoDayOfWeek value) { }
    public void InterfaceParameter(IClock value) { }
    public void NullableParameters(DateTimeZone? reference, Instant? value) { }
    public void RefParameter(ref Instant value) { }
    public void OutParameter(out LocalDate value) => value = AutoProperty;
    public void InParameter(in Instant value) { }
    public void RefReadonlyParameter(ref readonly Instant value) { }
    public void ParamsArrayParameter(params Instant[] values) { }
    public void ParamsSpanParameter(params ReadOnlySpan<LocalDate> values) { }
    public void OptionalEnumParameter(IsoDayOfWeek value = IsoDayOfWeek.Sunday) { }
    public void OptionalStructParameter(Instant value = default) { }
    public void OptionalClassParameter(DateTimeZone? value = null) { }
    public void ArrayParameter(Instant[] values) { }
    public void GenericParameters(List<Instant> list, Dictionary<IsoDayOfWeek, LocalDate> dictionary) { }
    public void TupleParameter((Instant Start, IsoDayOfWeek Day) value) { }
    public void FrameworkDelegateOfNuGetTypesParameter(Func<Instant, LocalDate> selector, Action<ZonedDateTime> action) { }
    public void AttributedParameter([NotNull] DateTimeZone zone, [ValueRange(1, 7)] int dayNumber, [NoEnumeration] IEnumerable<Instant> instants) { }

    [MustUseReturnValue]
    public DateTimeZone AttributedReturn() => ClassField;

    // Generics.
    public T ConstrainedToClass<T>(T value) where T : DateTimeZone => value;
    public T ConstrainedToInterface<T>(T value) where T : IClock => value;
    public T ConstrainedToGenericInterface<T>(T value) where T : IPattern<LocalDate> => value;
    public T ConstrainedToStruct<T>(T value) where T : struct, IEquatable<Instant> => value;

    public void ExplicitTypeArguments()
    {
        _ = ConstrainedToClass<DateTimeZone>(ClassField);
        _ = Enumerable.Empty<Instant>();
        _ = new List<LocalDate>();
        _ = new Dictionary<IsoDayOfWeek, Duration>();
        _ = default(Instant);
    }

    // Operators and conversions with NuGet operand types.
    public static NuGetPackageTypeUsage operator +(NuGetPackageTypeUsage left, Duration right) => left;
    public static implicit operator Instant(NuGetPackageTypeUsage value) => value.StructField;
    public static explicit operator NuGetPackageTypeUsage(Instant value) => new(SystemClock.Instance, value) { RequiredProperty = Utc };

    // Body-level use, including calls into the package: static, instance, operator, indexer, extension.
    public void BodyLevelUse(object input)
    {
        Instant localVariable = Instant.FromUtc(2026, 1, 1, 0, 0);
        var inferredLocalVariable = new LocalDate(2026, 1, 1);
        Instant[] arrayCreation = new Instant[1];
        List<Period> collectionExpression = [];
        object boxed = localVariable;
        Instant cast = (Instant)boxed;
        DateTimeZone? asCast = boxed as DateTimeZone;
        bool typeTest = boxed is Instant;
        bool patternTest = boxed is LocalDate { Year: 2026 } matched && matched.Year == 2026;
        string switchOnType = boxed switch
        {
            Instant => nameof(Instant),
            LocalDate => nameof(LocalDate),
            _ => "",
        };
        Type typeOf = typeof(Instant);
        Type openGenericTypeOf = typeof(IPattern<>);
        string nameOf = nameof(Instant);
        Func<Instant, IsoDayOfWeek> typedLambda = (Instant value) => value.InUtc().DayOfWeek;
        Duration LocalFunction(Instant value, in Instant other) => value - other;
        foreach (Instant item in GenericCollectionField) { }
        try
        {
            throw new DateTimeZoneNotFoundException("fixture");
        }
        catch (DateTimeZoneNotFoundException exception) when (exception.Message.Length >= 0)
        {
        }
        catch (UnparsableValueException)
        {
        }
        EventWithNuGetArgs?.Invoke(this, localVariable);
        // Calls into the package.
        Instant now = InterfaceField.GetCurrentInstant();                              // interface method
        Instant staticFactory = Instant.FromUnixTimeSeconds(0);                         // static method on a struct
        ZonedDateTime instanceMethod = now.InZone(ClassField);                          // instance method
        LocalDate propertyOfNuGetType = instanceMethod.Date;                            // property
        int fieldOfNuGetType = Period.Zero.Days;                                        // property on static property
        Duration operatorOfNuGetType = now - staticFactory;                             // user-defined operator from the package
        LocalDate operatorWithTwoNuGetTypes = inferredLocalVariable + Period.FromDays(1);
        bool comparisonOperator = now > staticFactory;
        DateTimeZone indexerOfNuGetType = ProviderField["Europe/Warsaw"];               // indexer
        ParseResult<LocalDate> genericResult = LocalDatePattern.Iso.Parse("2026-01-01"); // generic class from the package
        Instant maximum = Instant.Max(now, staticFactory);
        int minusOperatorOnOwnOperand = (this + operatorOfNuGetType).GetHashCode();
        DateTimeOffset conversionToFramework = now.ToDateTimeOffset();
        LocalDate viaExtensionOnNuGetType = now.ClassicExtensionOnNuGetType();
        var (year, month, day) = inferredLocalVariable;

        _ = (inferredLocalVariable, arrayCreation, collectionExpression, cast, asCast, typeTest, patternTest,
            switchOnType, typeOf, openGenericTypeOf, nameOf, typedLambda, LocalFunction(localVariable, in localVariable),
            propertyOfNuGetType, fieldOfNuGetType, operatorOfNuGetType, operatorWithTwoNuGetTypes, comparisonOperator,
            indexerOfNuGetType, genericResult, maximum, minusOperatorOnOwnOperand, conversionToFramework,
            viaExtensionOnNuGetType, year, month, day);
    }

    // Interface and base-class members whose signatures carry NuGet types.
    public Instant GetCurrentInstant() => InterfaceField.GetCurrentInstant();
    public ParseResult<LocalDate> Parse(string text) => LocalDatePattern.Iso.Parse(text);
    public string Format(LocalDate value) => LocalDatePattern.Iso.Format(value);
    public StringBuilder AppendFormat(LocalDate value, StringBuilder builder) => LocalDatePattern.Iso.AppendFormat(value, builder);
    public int Compare(ZonedDateTime x, ZonedDateTime y) => 0;
    public override ZoneInterval GetZoneInterval(Instant instant) => new("Fixture", null, null, Offset.Zero, Offset.Zero);

    public class NestedClassWithNuGetTypes
    {
        public Instant FieldInNestedClass;
    }
}

public struct StructWithNuGetTypeMembers
{
    public DateTimeZone ClassFieldInStruct;
    public Instant? NullableStructFieldInStruct;
    public IsoDayOfWeek EnumPropertyInStruct { get; set; }
}

public record RecordWithNuGetTypeMembers(DateTimeZone Positional, Instant PositionalStruct, IsoDayOfWeek PositionalEnum = IsoDayOfWeek.Monday)
{
    public Period? NestedClassProperty { get; init; }
}

public record struct RecordStructWithNuGetTypeMembers(Instant Positional, IsoDayOfWeek Kind);

public interface IInterfaceWithNuGetTypeMembers : IClock
{
    DateTimeZone PropertyOfNuGetType { get; }
    Instant MethodWithNuGetTypes(IsoDayOfWeek kind, IClock other);
    event Action<Instant>? EventOfNuGetArgumentType;
    DateTimeZone this[IsoDayOfWeek key] { get; }
}

public delegate Duration DelegateWithNuGetTypes(Instant argument, ref IsoDayOfWeek kind, out LocalDate date);

public class GenericClassConstrainedToNuGetTypes<TClass, TInterface, TStruct>
    where TClass : DateTimeZone
    where TInterface : IPattern<LocalDate>
    where TStruct : struct, IEquatable<TStruct>, IComparable<Instant>
{
    public TClass? ConstrainedField;
}

public class DerivedFromGenericOfNuGetType : List<Instant>, IPattern<Instant>
{
    public ParseResult<Instant> Parse(string text) => InstantPattern.General.Parse(text);
    public string Format(Instant value) => InstantPattern.General.Format(value);
    public StringBuilder AppendFormat(Instant value, StringBuilder builder) => InstantPattern.General.AppendFormat(value, builder);
}

public static class ExtensionsOnNuGetTypes
{
    public static LocalDate ClassicExtensionOnNuGetType(this Instant receiver) => receiver.InUtc().Date;

    public static Instant ClassicExtensionOnNuGetStruct(this in Instant receiver) => receiver;

    extension(DateTimeZone receiver)
    {
        public Instant ExtensionMemberOnNuGetType => Instant.MinValue;

        public ZonedDateTime ExtensionMethodOnNuGetType(Instant instant) => instant.InZone(receiver);
    }

    extension<T>(T receiver) where T : IClock
    {
        public IsoDayOfWeek GenericExtensionConstrainedToNuGetType => IsoDayOfWeek.Monday;
    }
}
