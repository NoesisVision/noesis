using System.Diagnostics.CodeAnalysis;

namespace CSharpSyntax.FieldsAndProperties;

public class PropertyDeclarations
{
    private int _backingField;
    private readonly int[] _array = new int[4];
    private readonly Dictionary<string, int> _dictionary = [];

    public int AutoProperty { get; set; }
    public int AutoPropertyGetOnly { get; }
    public int AutoPropertyWithInit { get; init; }
    public int AutoPropertyWithInitializer { get; set; } = 1;
    public int AutoPropertyGetOnlyWithInitializer { get; } = 2;
    public int AutoPropertyWithPrivateSetter { get; private set; }
    public int AutoPropertyWithProtectedSetter { get; protected set; }
    public int AutoPropertyWithInternalSetter { get; internal set; }
    public int AutoPropertyWithProtectedInternalSetter { get; protected internal set; }
    public int AutoPropertyWithPrivateProtectedSetter { get; private protected set; }
    public int AutoPropertyWithPrivateGetter { private get; set; }
    public int AutoPropertyWithPrivateInit { get; private init; }
    public int SetOnlyProperty { set => _backingField = value; }
    public int InitOnlyProperty { init => _backingField = value; }

    public static int StaticAutoProperty { get; set; }
    public static int StaticPropertyWithInitializer { get; } = 1;
    public static int StaticExpressionBodiedProperty => 1;

    private int PrivateProperty { get; set; }
    internal int InternalProperty { get; set; }
    protected int ProtectedProperty { get; set; }
    protected internal int ProtectedInternalProperty { get; set; }
    private protected int PrivateProtectedProperty { get; set; }

    public int ExpressionBodiedProperty => _backingField;

    public int ExpressionBodiedAccessors
    {
        get => _backingField;
        set => _backingField = value;
    }

    public int BlockBodiedAccessors
    {
        get
        {
            return _backingField;
        }
        set
        {
            _backingField = value;
        }
    }

    public int MixedAccessorBodies
    {
        get => _backingField;
        set
        {
            if (value >= 0)
            {
                _backingField = value;
            }
        }
    }

    // `field` keyword: compiler-generated backing field accessed inside accessors.
    public int FieldKeywordProperty
    {
        get => field;
        set => field = value < 0 ? 0 : value;
    }

    public int FieldKeywordPropertyWithInitializer { get => field; set => field = value; } = 5;

    public string FieldKeywordLazyProperty => field ??= ComputeLazyValue();

    public int? NullableValueProperty { get; set; }
    public string? NullableReferenceProperty { get; set; }
    public string NonNullableReferencePropertyWithNullForgiving { get; set; } = null!;

    public required int RequiredProperty { get; set; }
    public required string RequiredInitProperty { get; init; }

    [Obsolete("Attributed property")]
    public int PropertyWithAttribute { get; set; }

    public int PropertyWithAttributeOnAccessor
    {
        [Obsolete("Attributed getter")]
        get => 0;
        set { }
    }

    [field: NonSerialized]
    public int PropertyWithAttributeOnBackingField { get; set; }

    [MemberNotNullWhen(true, nameof(NullableReferenceProperty))]
    public bool PropertyWithNullabilityAttribute => NullableReferenceProperty is not null;

    public ref int RefReturningProperty => ref _array[0];
    public ref readonly int RefReadonlyReturningProperty => ref _array[1];

    public (int, string) TupleProperty { get; set; }
    public (int Count, string Name) NamedTupleProperty { get; set; }
    public dynamic DynamicProperty { get; set; } = 1;
    public int[] ArrayProperty { get; set; } = [];
    public List<int> GenericProperty { get; set; } = [];
    public Func<int, int> DelegateProperty { get; set; } = static value => value;
    public Action ActionPropertyWithLambdaBody => () => { };

    public int this[int index]
    {
        get => _array[index];
        set => _array[index] = value;
    }

    public int this[string key] => _dictionary[key];

    public int this[int first, int second] => _array[first] + _array[second];

    public int this[params int[] indexes] => indexes.Length;

    private int this[int index, bool privateIndexer] => _array[index];

    public int this[Index index]
    {
        get => _array[index];
        init => _array[index] = value;
    }

    public int[] this[Range range] => _array[range];

    public unsafe int* PointerProperty { get; set; }

    public unsafe delegate*<int, int> FunctionPointerProperty { get; set; }

    public static int StaticPropertyWithStaticFieldBacking
    {
        get => s_staticBacking;
        set => s_staticBacking = value;
    }

    private static int s_staticBacking;

    public int PropertyWithPrivateBackingAndValidation
    {
        get => _backingField;
        set => _backingField = value is < 0 ? throw new ArgumentOutOfRangeException(nameof(value)) : value;
    }

    public PropertyDeclarations()
    {
        AutoPropertyGetOnly = 1;
    }

    private static string ComputeLazyValue() => "";
}

public abstract class PropertyModifiers
{
    public abstract int AbstractProperty { get; }
    public abstract int AbstractPropertyWithSetter { get; set; }
    public virtual int VirtualProperty { get; set; }
    public virtual int VirtualExpressionBodiedProperty => 1;
    public abstract int this[int index] { get; }
}

public class PropertyModifiersDerived : PropertyModifiers
{
    public override int AbstractProperty => 1;
    public override int AbstractPropertyWithSetter { get; set; }
    public override int VirtualProperty { get => base.VirtualProperty; set => base.VirtualProperty = value; }
    public sealed override int VirtualExpressionBodiedProperty => 2;
    public override int this[int index] => index;
}

public class PropertyHiding : PropertyModifiersDerived
{
    public new int VirtualProperty { get; set; }
}

public partial class PartialProperties
{
    public partial int PartialProperty { get; set; }

    public partial int this[int index] { get; }
}

public partial class PartialProperties
{
    private int _partialBacking;

    public partial int PartialProperty
    {
        get => _partialBacking;
        set => _partialBacking = value;
    }

    public partial int this[int index] => index;
}

public readonly struct PropertiesInReadonlyStruct(int value)
{
    public int AutoPropertyInReadonlyStruct { get; } = value;

    public int ExpressionBodiedPropertyInReadonlyStruct => AutoPropertyInReadonlyStruct * 2;
}

public struct PropertiesInStruct
{
    public int AutoPropertyInStruct { get; set; }

    public readonly int ReadonlyPropertyInStruct => AutoPropertyInStruct;

    public int PropertyWithReadonlyGetter
    {
        readonly get => AutoPropertyInStruct;
        set => AutoPropertyInStruct = value;
    }
}

public interface IPropertiesInInterface
{
    int GetOnlyPropertyInInterface { get; }

    int GetSetPropertyInInterface { get; set; }

    int PropertyWithDefaultImplementation => 1;

    static int StaticPropertyInInterface { get; set; }

    static abstract int StaticAbstractPropertyInInterface { get; }
}

public record PropertiesInRecord(int PositionalProperty, string PositionalPropertyWithDefault = "")
{
    public int InitOnlyPropertyInRecord { get; init; }

    public int MutablePropertyInRecord { get; set; }

    public int ComputedPropertyInRecord => this.PositionalProperty + 1;

    public int PositionalProperty { get; init; } = PositionalProperty;
}

public record struct PropertiesInRecordStruct(int PositionalProperty)
{
    public int ExtraProperty { get; set; } = 0;
}

public class PropertiesWithGenericTypes<T>
{
    public T? GenericProperty { get; set; }

    public T GenericPropertyWithDefault { get; set; } = default!;

    public List<T> GenericCollectionProperty { get; } = [];

    public IReadOnlyDictionary<string, T> GenericInterfaceProperty { get; init; } = new Dictionary<string, T>();
}

public static class PropertiesInStaticClass
{
    public static int StaticPropertyInStaticClass { get; set; }

    public static int StaticExpressionBodiedPropertyInStaticClass => 1;
}

public class PropertiesWithExplicitInterfaceImplementation : IPropertiesInInterface
{
    int IPropertiesInInterface.GetOnlyPropertyInInterface => 1;

    int IPropertiesInInterface.GetSetPropertyInInterface { get; set; }

    public static int StaticAbstractPropertyInInterface => 1;
}
