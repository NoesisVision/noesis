using CSharpSyntax.LocalVariables;
using CSharpSyntax.Types;

namespace CSharpSyntax.TypeUsage;

// Types declared in this project, in another namespace, used in every position a type can occupy.
// `OtherProjectTypeUsage` and `NuGetPackageTypeUsage` repeat the same positions with types from a
// referenced project and from NuGet packages, so a test can compare the three.
[CustomAttributeWithUsage("own project", NamedArgument = 1)]
[GenericAttribute<PublicClass>]
public class OwnProjectTypeUsage(PublicClass primaryConstructorParameter, PlainStruct primaryConstructorStruct)
    : AbstractClass, IPlainInterface, IGenericInterface<PublicClass>, IComparer<PositionalRecord>
{
    // Fields.
    public PublicClass ClassField = new();
    public static PublicClass StaticClassField = new();
    public readonly PublicClass ReadonlyClassField = new();
    public const PlainEnum ConstEnumField = PlainEnum.Second;
    public PlainStruct StructField;
    public PlainStruct? NullableStructField;
    public PublicClass? NullableClassField;
    public PublicClass[] ArrayField = [];
    public PublicClass[][] JaggedArrayField = [];
    public List<PublicClass> GenericCollectionField = [];
    public Dictionary<PlainEnum, List<PublicClass>> NestedGenericField = [];
    public (PublicClass Class, PlainStruct Struct) TupleField = (new(), default);
    public DelegateWithReturnValue CustomDelegateField = static value => value;
    public Func<PublicClass, PlainStruct> FrameworkDelegateOfCustomTypesField = static _ => default;
    public IPlainInterface InterfaceField = new OwnProjectTypeUsage { RequiredProperty = new() };
    public IGenericInterface<PublicClass> GenericInterfaceField = new OwnProjectTypeUsage { RequiredProperty = new() };
    public PositionalRecord RecordField = new(1, "");
    public PublicClass PrimaryConstructorParameterField = primaryConstructorParameter;

    // Events with a custom delegate type and with custom event arguments.
    public event DelegateWithReturnValue? CustomDelegateEvent;
    public event EventHandler<PositionalRecord>? EventWithCustomArgs;

    // Properties.
    public PublicClass AutoProperty { get; set; } = new();
    public PublicClass InitProperty { get; init; } = new();
    public required PublicClass RequiredProperty { get; set; }
    public PlainStruct ExpressionBodiedProperty => primaryConstructorStruct;
    public PlainStruct? NullableStructProperty { get; set; }
    public static PublicClass StaticProperty { get; set; } = new();
    public IReadOnlyList<PublicClass> GenericInterfaceProperty { get; } = [];
    public ref PlainStruct RefReturningProperty => ref StructField;

    // Indexer with a custom parameter type and a custom return type.
    public PublicClass this[PlainEnum key] => ClassField;
    public PlainStruct this[PublicClass key, PositionalRecord second] => default;

    // Constructors.
    public OwnProjectTypeUsage() : this(new PublicClass(), default(PlainStruct)) { }

    public OwnProjectTypeUsage(PublicClass value, PlainEnum kind) : this(value, default(PlainStruct)) { }

    // Return types.
    public PublicClass ClassReturn() => ClassField;
    public PlainStruct StructReturn() => default;
    public PlainEnum EnumReturn() => PlainEnum.First;
    public PositionalRecord RecordReturn() => RecordField;
    public IPlainInterface InterfaceReturn() => this;
    public PublicClass? NullableClassReturn() => null;
    public PlainStruct? NullableStructReturn() => null;
    public PublicClass[] ArrayReturn() => [];
    public List<PublicClass> GenericReturn() => [];
    public (PublicClass, PlainEnum) TupleReturn() => (new(), PlainEnum.First);
    public DelegateWithReturnValue DelegateReturn() => CustomDelegateField;
    public async Task<PublicClass> AsyncReturn() => await Task.FromResult(ClassField);
    public IEnumerable<PublicClass> IteratorReturn()
    {
        yield return ClassField;
    }
    public ref PlainStruct RefReturn() => ref StructField;

    // Parameters.
    public void ClassParameter(PublicClass value) { }
    public void StructParameter(PlainStruct value) { }
    public void EnumParameter(PlainEnum value) { }
    public void RecordParameter(PositionalRecord value) { }
    public void InterfaceParameter(IPlainInterface value) { }
    public void NullableParameters(PublicClass? reference, PlainStruct? value) { }
    public void RefParameter(ref PlainStruct value) { }
    public void OutParameter(out PublicClass value) => value = new();
    public void InParameter(in PlainStruct value) { }
    public void RefReadonlyParameter(ref readonly PlainStruct value) { }
    public void ParamsArrayParameter(params PublicClass[] values) { }
    public void ParamsSpanParameter(params ReadOnlySpan<PublicClass> values) { }
    public void OptionalEnumParameter(PlainEnum value = PlainEnum.Third) { }
    public void OptionalStructParameter(PlainStruct value = default) { }
    public void OptionalClassParameter(PublicClass? value = null) { }
    public void ArrayParameter(PublicClass[] values) { }
    public void GenericParameters(List<PublicClass> list, Dictionary<PlainEnum, PublicClass> dictionary) { }
    public void TupleParameter((PublicClass Class, PlainEnum Kind) value) { }
    public void CustomDelegateParameter(DelegateWithReturnValue callback) { }
    public void FrameworkDelegateOfCustomTypesParameter(Func<PublicClass, PlainStruct> selector, Action<PositionalRecord> action) { }
    public void AttributedParameter([CustomAttributeWithUsage("parameter")] PublicClass value) { }

    [return: CustomAttributeWithUsage("return")]
    public PublicClass AttributedReturn() => ClassField;

    // Generics: explicit type arguments, constraints on custom types.
    public T ConstrainedToClass<T>(T value) where T : PublicClass => value;
    public T ConstrainedToInterface<T>(T value) where T : IPlainInterface => value;
    public T ConstrainedToGenericInterface<T>(T value) where T : IGenericInterface<PublicClass> => value;
    public T ConstrainedToStruct<T>(T value) where T : struct, IGenericInterface<PlainStruct> => value;

    public void ExplicitTypeArguments()
    {
        _ = ConstrainedToClass<PublicClass>(new());
        _ = Enumerable.Empty<PublicClass>();
        _ = new List<PlainStruct>();
        _ = new Dictionary<PlainEnum, PublicClass>();
        _ = default(PlainStruct);
    }

    // Operators and conversions with custom operand types.
    public static OwnProjectTypeUsage operator +(OwnProjectTypeUsage left, PlainStruct right) => left;
    public static implicit operator PublicClass(OwnProjectTypeUsage value) => value.ClassField;
    public static explicit operator OwnProjectTypeUsage(PublicClass value) => new(value, PlainEnum.First) { RequiredProperty = value };

    // Body-level use.
    public void BodyLevelUse(object input)
    {
        PublicClass localVariable = new();
        var inferredLocalVariable = new PlainStruct();
        PublicClass[] arrayCreation = new PublicClass[1];
        List<PositionalRecord> collectionExpression = [];
        object boxed = localVariable;
        PublicClass cast = (PublicClass)boxed;
        PublicClass? asCast = boxed as PublicClass;
        bool typeTest = boxed is PublicClass;
        bool patternTest = boxed is PositionalRecord { First: 1 } matched && matched.Second.Length >= 0;
        string switchOnType = boxed switch
        {
            PublicClass => nameof(PublicClass),
            PlainStruct => nameof(PlainStruct),
            _ => "",
        };
        Type typeOf = typeof(PublicClass);
        string nameOf = nameof(PublicClass);
        Func<PublicClass, PlainEnum> typedLambda = (PublicClass value) => PlainEnum.First;
        PlainStruct LocalFunction(PublicClass value, in PlainStruct other) => other;
        foreach (PublicClass item in GenericCollectionField) { }
        using (DisposableForLocals disposable = new()) { }
        using DisposableForLocals disposableDeclaration = new();
        try
        {
            throw new ClassDerivedFromException();
        }
        catch (ClassDerivedFromException exception) when (exception.Message.Length >= 0)
        {
        }
        PositionalRecord withExpression = RecordField with { First = 2 };
        CustomDelegateEvent += static value => value;
        EventWithCustomArgs?.Invoke(this, RecordField);

        _ = (inferredLocalVariable, arrayCreation, collectionExpression, cast, asCast, typeTest, patternTest,
            switchOnType, typeOf, nameOf, typedLambda, LocalFunction(localVariable, in inferredLocalVariable),
            disposableDeclaration, withExpression);
    }

    // Interface members whose signatures carry custom types.
    public override void AbstractMethodInAbstractClass() { }
    public void MethodInInterface() { }
    public PublicClass GetValue() => ClassField;
    public int Compare(PositionalRecord? x, PositionalRecord? y) => 0;

    public class NestedClassWithCustomTypes
    {
        public PublicClass FieldInNestedClass = new();
    }
}

public struct StructWithCustomTypeMembers
{
    public PublicClass ClassFieldInStruct;
    public PlainStruct? NullableStructFieldInStruct;
    public PlainEnum EnumPropertyInStruct { get; set; }
}

public record RecordWithCustomTypeMembers(PublicClass Positional, PlainStruct PositionalStruct, PlainEnum PositionalEnum = PlainEnum.First)
{
    public PositionalRecord? NestedRecordProperty { get; init; }
}

public record struct RecordStructWithCustomTypeMembers(PublicClass Positional, PlainEnum Kind);

public interface IInterfaceWithCustomTypeMembers
{
    PublicClass PropertyOfCustomType { get; }
    PlainStruct MethodWithCustomTypes(PlainEnum kind, IPlainInterface other);
    event DelegateWithReturnValue? EventOfCustomDelegateType;
    PublicClass this[PlainEnum key] { get; }
}

public delegate PlainStruct DelegateWithCustomTypes(PublicClass argument, ref PlainEnum kind, out PositionalRecord record);

public delegate TResult GenericDelegateConstrainedToCustomType<T, out TResult>(T argument) where T : PublicClass where TResult : IPlainInterface;

public class GenericClassConstrainedToCustomTypes<TClass, TInterface, TStruct>
    where TClass : PublicClass, new()
    where TInterface : IGenericInterface<PublicClass>
    where TStruct : struct, IGenericInterface<PlainStruct>
{
    public TClass ConstrainedField = new();
}

public class DerivedFromGenericOfOwnType : List<PublicClass>, IGenericInterface<PlainStruct>
{
    public PlainStruct GetValue() => default;
}

public enum EnumInTypeUsage
{
    Member,
}

public static class ExtensionsOnCustomTypes
{
    public static PlainEnum ClassicExtensionOnCustomType(this PublicClass receiver) => PlainEnum.First;

    public static PlainStruct ClassicExtensionOnCustomStruct(this in PlainStruct receiver) => receiver;

    extension(PositionalRecord receiver)
    {
        public PublicClass ExtensionMemberOnCustomType => new();

        public PlainStruct ExtensionMethodOnCustomType(PlainEnum kind) => default;
    }

    extension<T>(T receiver) where T : IPlainInterface
    {
        public PlainEnum GenericExtensionConstrainedToCustomType => PlainEnum.First;
    }
}
