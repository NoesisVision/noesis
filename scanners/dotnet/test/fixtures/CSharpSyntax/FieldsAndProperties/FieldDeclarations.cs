using System.Runtime.CompilerServices;

namespace CSharpSyntax.FieldsAndProperties;

public unsafe class FieldDeclarations
{
    public int PublicField;
    private int _privateField;
    internal int InternalField;
    protected int ProtectedField;
    protected internal int ProtectedInternalField;
    private protected int PrivateProtectedField;
    int FieldWithoutAccessModifier;

    public static int StaticField;
    public readonly int ReadonlyField;
    public static readonly int StaticReadonlyField = 1;
    public const int ConstField = 1;
    public const string ConstStringField = "constant";
    public const PlainEnumForFields ConstEnumField = PlainEnumForFields.Member;
    public const int ConstFieldComputedFromOtherConst = ConstField * 2;
    public volatile int VolatileField;
    public static volatile bool StaticVolatileField;

    public int FieldWithInitializer = 1;
    public string FieldWithTargetTypedNewInitializer = new('x', 3);
    public List<int> FieldWithCollectionExpressionInitializer = [1, 2];
    public int[] FieldWithArrayInitializer = { 1, 2, 3 };
    public int FieldInitializedFromStaticMethod = ComputeInitialValue();
    public int FieldInitializedFromOtherFieldViaConstructor;
    public int FirstDeclarator, SecondDeclarator = 2, ThirdDeclarator;
    public static int StaticFieldInitializedInStaticConstructor;

    public int? NullableValueField;
    public string? NullableReferenceField;
    public string NonNullableReferenceFieldInitializedToDefault = default!;
    public string NonNullableReferenceFieldInitializedWithNullForgiving = null!;

    public required int RequiredField;
    public required string RequiredReferenceField;

    [ThreadStatic] public static int ThreadStaticField;

    [Obsolete("Attributed field")] public int FieldWithAttribute;

    [field: NonSerialized] public int FieldWithTargetedAttribute;


    public int* PointerField;

    public delegate*<void> FunctionPointerField;

    public Action? DelegateField;
    public Func<int, int> DelegateFieldWithLambdaInitializer = static value => value;
    public Func<int, int> DelegateFieldWithMethodGroupInitializer = ComputeInitialValue;

    public event EventHandler? FieldLikeEvent;
    public event EventHandler? FieldLikeEventWithInitializer = static (_, _) => { };
    public static event EventHandler? StaticFieldLikeEvent;
    public event Action<int>? GenericDelegateEvent;

    public (int, string) TupleField;
    public (int Count, string Name) NamedTupleField = (1, "");
    public dynamic DynamicField = 1;
    public object BoxedField = 1;

    public FieldDeclarations()
    {
        ReadonlyField = 2;
        FieldInitializedFromOtherFieldViaConstructor = FieldWithInitializer;
    }

    static FieldDeclarations()
    {
        StaticFieldInitializedInStaticConstructor = 3;
    }

    private static int ComputeInitialValue() => 1;

    private static int ComputeInitialValue(int value) => value;
}

public enum PlainEnumForFields
{
    Member,
}

public struct FieldsInStruct
{
    public int FieldWithoutInitializer;
    public int FieldWithInitializer = 1;
    public static int StaticFieldInStruct;
    public const int ConstFieldInStruct = 1;
    public readonly int ReadonlyFieldInStruct;

    public FieldsInStruct()
    {
        ReadonlyFieldInStruct = 2;
    }
}

public ref struct FieldsInRefStruct
{
    public ref int RefField;
    public ref readonly int RefReadonlyField;
    public readonly ref int ReadonlyRefField;
    public readonly ref readonly int ReadonlyRefReadonlyField;
    public Span<int> SpanField;
}

public interface IFieldsInInterface
{
    const int ConstFieldInInterface = 1;

    static int StaticFieldInInterface = 2;

    static readonly int StaticReadonlyFieldInInterface = 3;
}

public static class FieldsInStaticClass
{
    public static int StaticFieldInStaticClass;

    public static readonly object StaticReadonlyObjectField = new();

    public const int ConstFieldInStaticClass = 1;
}

public record FieldsInRecord(int Positional)
{
    public int FieldInRecord;

    public readonly int ReadonlyFieldInRecord = 1;

    private int _privateFieldInRecord;
}

public class FieldsWithGenericTypes<T>
{
    public T? GenericField;

    public T GenericFieldInitializedWithDefault = default!;

    public List<T> GenericCollectionField = [];

    public Dictionary<string, List<T>> NestedGenericField = [];

    public T[] GenericArrayField = [];
}

public class FieldsWithInitializersReferencingMembers
{
    private readonly int _first = 1;

    private readonly int _second;

    private readonly Func<int> _closure;

    public FieldsWithInitializersReferencingMembers()
    {
        _second = _first + 1;
        _closure = () => _first + _second;
    }
}
