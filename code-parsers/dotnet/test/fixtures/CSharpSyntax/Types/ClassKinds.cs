namespace CSharpSyntax.Types;

public class PublicClass;

internal class InternalClass;

public static class StaticClass
{
    public static void StaticMethodInStaticClass() { }
}

public abstract class AbstractClass
{
    public abstract void AbstractMethodInAbstractClass();
}

public sealed class SealedClass;

public partial class PartialClass
{
    public void MethodInFirstPart() { }
}

public partial class PartialClass
{
    public void MethodInSecondPart() { }
}

public class ClassWithPrimaryConstructor(int primaryConstructorParameter)
{
    public int PrimaryConstructorParameterExposed => primaryConstructorParameter;
}

public unsafe class UnsafeClass
{
    public int* PointerFieldInUnsafeClass;
}

// Visible only inside this file.
file class FileLocalClass;

public class ClassUsingFileLocalClass
{
    private readonly object _fileLocalInstance = new FileLocalClass();
}

public class ClassWithExplicitObjectBase : object;

class ClassWithoutAccessModifierIsInternal;

public abstract partial class AbstractPartialClass;

public abstract partial class AbstractPartialClass
{
    public abstract void AbstractMethodInPartialClass();
}

public static partial class StaticPartialClass;

public static partial class StaticPartialClass
{
    public static void MethodInStaticPartialClass() { }
}

public sealed partial class SealedPartialClass;

public sealed partial class SealedPartialClass;

file struct FileLocalStruct;

file interface IFileLocalInterface;

file enum FileLocalEnum
{
    Member,
}

file record FileLocalRecord(int Value);

file static class FileLocalStaticClass
{
    public static FileLocalStruct CreateStruct() => default;

    public static FileLocalEnum CreateEnum() => FileLocalEnum.Member;

    public static FileLocalRecord CreateRecord() => new(1);

    public static IFileLocalInterface? CreateInterface() => null;
}

public class ClassWithEmptyBodyBraces
{
}

public class OuterClassWithNestedTypes
{
    public class PublicNestedClass;

    private class PrivateNestedClass;

    protected class ProtectedNestedClass;

    internal class InternalNestedClass;

    protected internal class ProtectedInternalNestedClass;

    private protected class PrivateProtectedNestedClass;

    public static class StaticNestedClass;

    public abstract class AbstractNestedClass;

    public sealed class SealedNestedClass;

    public struct NestedStruct;

    public interface INestedInterface;

    public enum NestedEnum
    {
        NestedEnumMember,
    }

    public delegate void NestedDelegate();

    public record NestedRecord(int Value);

    public record struct NestedRecordStruct(int Value);

    public class NestedClassWithNestedClass
    {
        public class DoublyNestedClass;
    }

    public class GenericNestedClass<T>;
}

public struct StructWithNestedTypes
{
    public class ClassNestedInStruct;

    public struct StructNestedInStruct;
}

public interface IInterfaceWithNestedTypes
{
    public class ClassNestedInInterface;

    public enum EnumNestedInInterface
    {
        Member,
    }
}

public class ClassDerivedFromAttribute : Attribute;

public class ClassDerivedFromException : Exception;

[AttributeUsage(AttributeTargets.All, AllowMultiple = true, Inherited = false)]
public sealed class CustomAttributeWithUsage(string positionalArgument) : Attribute
{
    public string PositionalArgument => positionalArgument;

    public int NamedArgument { get; set; }
}

public class GenericAttribute<T> : Attribute;

[Obsolete("Attributed")]
[CustomAttributeWithUsage("first", NamedArgument = 1)]
[CustomAttributeWithUsage("second")]
[GenericAttribute<int>]
public class ClassWithAttributes;
