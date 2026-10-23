namespace CSharpSyntax.Types;

public unsafe class BuiltInTypesAsFields
{
    public bool BoolField;
    public byte ByteField;
    public sbyte SignedByteField;
    public char CharField;
    public decimal DecimalField;
    public double DoubleField;
    public float FloatField;
    public int IntField;
    public uint UnsignedIntField;
    public nint NativeIntField;
    public nuint NativeUnsignedIntField;
    public long LongField;
    public ulong UnsignedLongField;
    public short ShortField;
    public ushort UnsignedShortField;
    public object ObjectField = new();
    public string StringField = "";
    public dynamic DynamicField = 1;

    public System.Int32 IntFieldViaSystemName;
    public System.String StringFieldViaSystemName = "";
    public System.Boolean BoolFieldViaSystemName;
    public System.IntPtr IntPtrField;
    public System.UIntPtr UIntPtrField;

    public int? NullableIntField;
    public Nullable<int> NullableIntFieldViaGenericName;
    public string? NullableStringField;
    public object? NullableObjectField;

    public int[] SingleDimensionalArrayField = [];
    public int[,] TwoDimensionalArrayField = new int[0, 0];
    public int[,,] ThreeDimensionalArrayField = new int[0, 0, 0];
    public int[][] JaggedArrayField = [];
    public int[][,] JaggedArrayOfTwoDimensionalArraysField = [];
    public string?[] ArrayOfNullableStringsField = [];
    public int?[] ArrayOfNullableIntsField = [];
    public Array NonGenericArrayField = Array.Empty<int>();

    public (int, string) UnnamedTupleField;
    public (int Count, string Name) NamedTupleField;
    public (int, (string, bool)) NestedTupleField;
    public ValueTuple<int, string> TupleFieldViaGenericName;
    public Tuple<int, string> ReferenceTupleField = Tuple.Create(1, "");

    public int* IntPointerField;
    public void* VoidPointerField;
    public int** PointerToPointerField;
    public delegate*<int, int> ManagedFunctionPointerField;
    public delegate* unmanaged<int, int> UnmanagedFunctionPointerField;
    public delegate* unmanaged[Cdecl]<int, void> UnmanagedFunctionPointerWithCallingConventionField;

    public List<int> GenericListField = [];
    public Dictionary<string, List<int>> NestedGenericField = [];
    public IEnumerable<KeyValuePair<string, int[]>> GenericInterfaceField = [];
    public Memory<byte> MemoryField;
    public ReadOnlyMemory<char> ReadOnlyMemoryField;
    public Index IndexField;
    public Range RangeField;
    public Func<int, string> FuncField = static value => value.ToString();
    public Action ActionField = static () => { };
    public Predicate<int> PredicateField = static value => value > 0;
    public Type TypeField = typeof(int);
    public Delegate DelegateBaseTypeField = static () => { };
    public MulticastDelegate MulticastDelegateBaseTypeField = static () => { };
    public Enum EnumBaseTypeField = PlainEnum.First;
    public ValueType ValueTypeBaseTypeField = 1;
    public Task TaskField = Task.CompletedTask;
    public ValueTask<int> ValueTaskField;
    public Lazy<string> LazyField = new(() => "");
    public DateTime DateTimeField;
    public DateOnly DateOnlyField;
    public TimeOnly TimeOnlyField;
    public TimeSpan TimeSpanField;
    public DateTimeOffset DateTimeOffsetField;
    public Guid GuidField;
    public Half HalfField;
    public Int128 Int128Field;
    public UInt128 UInt128Field;
    public System.Numerics.BigInteger BigIntegerField;
    public System.Numerics.Complex ComplexField;
    public System.Numerics.Vector<float> VectorField;
    public System.Threading.Lock LockField = new();
    public Exception ExceptionField = new();
    public OuterClassWithNestedTypes.PublicNestedClass NestedTypeField = new();
    public OuterClassWithNestedTypes.GenericNestedClass<string> GenericNestedTypeField = new();
    public GenericStruct<GenericRecord<PositionalRecordStruct>> DeeplyNestedGenericField;
    public global::System.Object FullyQualifiedObjectField = new();
}

public ref struct SpanTypesAsFields
{
    public Span<int> SpanField;
    public ReadOnlySpan<char> ReadOnlySpanField;
    public RefStruct NestedRefStructField;
}

public class AnonymousAndImplicitTypes
{
    public object CreateAnonymousType() => new { AnonymousProperty = 1, AnonymousNested = new { Inner = "" } };

    public object CreateAnonymousTypeWithProjectionInitializer(string value) => new { value, value.Length };

    public (int, string) CreateTupleLiteral() => (1, "");
}
