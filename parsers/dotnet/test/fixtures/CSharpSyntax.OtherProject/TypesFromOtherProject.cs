using System.Runtime.CompilerServices;

// Lets the CSharpSyntax project use the internal types declared below.
[assembly: InternalsVisibleTo("CSharpSyntax")]

namespace CSharpSyntax.OtherProject;

public class PublicClassFromOtherProject
{
    public int PublicPropertyFromOtherProject { get; set; }

    public string PublicMethodFromOtherProject() => nameof(PublicMethodFromOtherProject);

    public static string PublicStaticMethodFromOtherProject() => nameof(PublicStaticMethodFromOtherProject);

    public class NestedClassFromOtherProject;
}

internal class InternalClassVisibleViaInternalsVisibleTo
{
    internal string InternalMethodFromOtherProject() => nameof(InternalMethodFromOtherProject);
}

public static class StaticClassFromOtherProject
{
    public const int ConstantFromOtherProject = 42;

    public static int StaticMethodFromOtherProject() => ConstantFromOtherProject;

    public static string ClassicExtensionMethodFromOtherProject(this string receiver) => receiver;

    extension(int receiver)
    {
        public int ExtensionMemberPropertyFromOtherProject => receiver * 2;
    }
}

public interface IInterfaceFromOtherProject
{
    void MethodFromOtherProjectInterface();
}

public abstract class AbstractBaseClassFromOtherProject
{
    public abstract void AbstractMethodFromOtherProject();
}

public struct StructFromOtherProject
{
    public int ValueFromOtherProject;
}

public enum EnumFromOtherProject
{
    FirstFromOtherProject,
    SecondFromOtherProject,
}

public record RecordFromOtherProject(int ValueFromOtherProject);

public delegate void DelegateFromOtherProject(int argument);

public class GenericClassFromOtherProject<T>
{
    public T? ValueFromOtherProject { get; set; }
}

public interface IGenericInterfaceFromOtherProject<T>
{
    T GenericMethodFromOtherProjectInterface(T value);
}

public class EventArgsFromOtherProject : EventArgs;

public class ExceptionFromOtherProject : Exception;

public sealed class DisposableFromOtherProject : IDisposable
{
    public void Dispose() { }
}

[AttributeUsage(AttributeTargets.All, AllowMultiple = true)]
public sealed class AttributeFromOtherProject(Type positionalType) : Attribute
{
    public Type PositionalType => positionalType;

    public EnumFromOtherProject NamedEnumArgument { get; set; }
}
