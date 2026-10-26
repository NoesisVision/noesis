using System.Runtime.InteropServices;

namespace CSharpSyntax.Types;

public struct PlainStruct
{
    public int FieldInStruct;
}

public readonly struct ReadonlyStruct(int value)
{
    public readonly int FieldInReadonlyStruct = value;

    public int PropertyInReadonlyStruct { get; } = value;
}

public ref struct RefStruct
{
    public Span<int> SpanFieldInRefStruct;
}

public readonly ref struct ReadonlyRefStruct(ReadOnlySpan<byte> bytes)
{
    public readonly ReadOnlySpan<byte> SpanFieldInReadonlyRefStruct = bytes;
}

public ref struct RefStructWithRefField
{
    public ref int RefField;

    public ref readonly int RefReadonlyField;
}

public partial struct PartialStruct
{
    public int FieldInFirstPart;

    public int FieldInSecondPartDeclaredInFirstPartToKeepLayoutOrdered;
}

public partial struct PartialStruct
{
    public readonly int MethodInSecondPart() => FieldInFirstPart;
}

public struct StructWithPrimaryConstructor(int value)
{
    public int Value => value;
}

public struct StructWithConstructorAndFieldInitializers
{
    public int InitializedField = 1;

    public int PropertyWithInitializer { get; set; } = 2;

    public StructWithConstructorAndFieldInitializers() { }
}

public unsafe struct StructWithFixedSizeBuffer
{
    public fixed byte FixedSizeBuffer[16];

    public fixed int FixedSizeIntBuffer[4];
}

[StructLayout(LayoutKind.Explicit)]
public struct StructWithExplicitLayout
{
    [FieldOffset(0)] public int IntView;

    [FieldOffset(0)] public float FloatView;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct StructWithSequentialLayout
{
    public byte First;

    public int Second;
}

public struct GenericStruct<T>
{
    public T? ValueInGenericStruct;
}

public struct StructWithReadonlyMembers
{
    private int _counter;

    public readonly int ReadonlyMethodInStruct() => _counter;

    public readonly int ReadonlyPropertyInStruct => _counter;

    public void MutatingMethodInStruct() => _counter++;
}

internal struct InternalStruct;
