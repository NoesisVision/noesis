using CSharpSyntax.Types;

namespace CSharpSyntax.Invocations;

public class InvocationTarget
{
    public int InstanceMethod() => 1;

    public int InstanceMethodWithArguments(int first, string second = "", params int[] rest) => first + rest.Length;

    public void InstanceMethodWithRefKinds(ref int byRef, out int output, in int byIn) => output = byRef + byIn;

    public T GenericInstanceMethod<T>(T value) => value;

    public InvocationTarget ReturnsSelf() => this;

    public InvocationTarget? ReturnsNullableSelf() => this;

    public Func<int> ReturnsDelegate() => InstanceMethod;

    public Func<int, Func<int, int>> ReturnsCurriedDelegate() => first => second => first + second;

    public int[] ReturnsArray() => [1];

    public (InvocationTarget Target, int Value) ReturnsTuple() => (this, 1);

    public Task<InvocationTarget> ReturnsTaskOfSelf() => Task.FromResult(this);

    public InvocationTarget PropertyReturningSelf => this;

    public InvocationTarget FieldHoldingSelf;

    public InvocationTarget this[int index] => this;

    public Func<int> DelegateProperty { get; } = static () => 1;

    public Func<int, int> DelegateField = static value => value;

    public Action? NullableDelegateField;

    public event EventHandler? Event;

    public static int StaticMethod() => 1;

    public static T StaticGenericMethod<T>(T value) => value;

    public static InvocationTarget StaticFactory() => new();

    public static InvocationTarget StaticProperty { get; } = new();

    public static InvocationTarget StaticField = new();

    public InvocationTarget() => FieldHoldingSelf = this;

    public InvocationTarget(int ignored) : this() { }

    public void RaiseEvent() => Event?.Invoke(this, EventArgs.Empty);

    public override string ToString() => nameof(InvocationTarget);

    public void Deconstruct(out int first, out int second) => (first, second) = (1, 2);

    public class NestedStaticHolder
    {
        public static int NestedStaticMethod() => 1;

        public class DoublyNested
        {
            public static int DoublyNestedStaticMethod() => 1;
        }
    }
}

public class InvocationBase
{
    public virtual int VirtualMethod() => 1;

    public int BaseOnlyMethod() => 1;

    protected int ProtectedBaseMethod() => 1;

    public static int StaticBaseMethod() => 1;
}

public interface IInvocationInterface
{
    int InterfaceMethod();

    int DefaultInterfaceMethod() => 1;

    static int StaticInterfaceMethod() => 1;

    static abstract int StaticAbstractInterfaceMethod();
}

public class InvocationDerived : InvocationBase, IInvocationInterface
{
    public override int VirtualMethod() => base.VirtualMethod() + 1;

    public int InterfaceMethod() => 1;

    int IInvocationInterface.DefaultInterfaceMethod() => 2;

    public static int StaticAbstractInterfaceMethod() => 1;

    public int CallProtectedBase() => ProtectedBaseMethod();
}

public static class InvocationExtensions
{
    public static int ClassicExtensionMethod(this InvocationTarget receiver) => receiver.InstanceMethod();

    public static int ClassicExtensionMethodWithArguments(this InvocationTarget receiver, int value) => value;

    public static T ClassicGenericExtensionMethod<T>(this T receiver) => receiver;

    public static int ClassicExtensionOnInterface(this IInvocationInterface receiver) => receiver.InterfaceMethod();

    public static int ClassicExtensionOnNullable(this InvocationTarget? receiver) => 1;

    public static int ClassicExtensionOnValueType(this int receiver) => receiver;

    public static int ClassicExtensionOnRefStruct(this ref int receiver) => receiver;

    extension(InvocationTarget receiver)
    {
        public int ExtensionMemberMethod() => receiver.InstanceMethod();

        public int ExtensionMemberProperty => receiver.InstanceMethod();

        public static int ExtensionMemberStaticMethod() => 1;

        public static int ExtensionMemberStaticProperty => 1;
    }

    extension(string receiver)
    {
        public int ExtensionMemberOnString() => receiver.Length;
    }

    extension<T>(T receiver) where T : notnull
    {
        public string ExtensionMemberGeneric() => receiver.ToString()!;
    }
}

public unsafe class FunctionPointerHolder
{
    public delegate*<int, int> FunctionPointer = &Identity;

    public static int Identity(int value) => value;
}
