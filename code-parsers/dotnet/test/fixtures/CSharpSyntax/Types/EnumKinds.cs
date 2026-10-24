namespace CSharpSyntax.Types;

public enum PlainEnum
{
    First,
    Second,
    Third,
}

public enum EnumWithExplicitValues
{
    Ten = 10,
    Twenty = 20,
    TwentyOne,
    SameAsTen = Ten,
}

public enum EnumWithByteUnderlyingType : byte
{
    Zero,
    One,
}

public enum EnumWithSignedByteUnderlyingType : sbyte
{
    MinusOne = -1,
}

public enum EnumWithShortUnderlyingType : short { Member }

public enum EnumWithUnsignedShortUnderlyingType : ushort { Member }

public enum EnumWithUnsignedIntUnderlyingType : uint { Member }

public enum EnumWithLongUnderlyingType : long
{
    Big = 1L << 40,
}

public enum EnumWithUnsignedLongUnderlyingType : ulong
{
    Max = ulong.MaxValue,
}

[Flags]
public enum FlagsEnum
{
    None = 0,
    Read = 1,
    Write = 1 << 1,
    Execute = 0b100,
    ReadWrite = Read | Write,
    All = Read | Write | Execute,
}

public enum EnumWithHexAndBinaryLiterals
{
    Hex = 0xFF,
    Binary = 0b1010_1010,
    WithSeparator = 1_000_000,
}

internal enum InternalEnum
{
}

public enum EnumWithAttributedMembers
{
    [Obsolete] ObsoleteMember,
    Normal,
}
