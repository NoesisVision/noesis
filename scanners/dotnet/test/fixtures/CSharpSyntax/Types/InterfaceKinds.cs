namespace CSharpSyntax.Types;

public interface IPlainInterface
{
    void MethodInInterface();
}

internal interface IInternalInterface;

public interface IInterfaceWithProperty
{
    int GetOnlyProperty { get; }

    int GetSetProperty { get; set; }

    int GetInitProperty { get; init; }
}

public interface IInterfaceWithEvent
{
    event EventHandler EventInInterface;
}

public interface IInterfaceWithIndexer
{
    int this[int index] { get; set; }
}

public interface IInterfaceWithDefaultMethod
{
    void MethodWithDefaultBody()
    {
    }

    int PropertyWithDefaultGetter => 1;
}

public interface IInterfaceWithStaticMembers
{
    const int ConstantInInterface = 1;

    static int StaticFieldInInterface = 2;

    static readonly int StaticReadonlyFieldInInterface = 3;

    static int StaticMethodInInterface() => StaticFieldInInterface;

    static int StaticPropertyInInterface { get; set; }
}

public interface IInterfaceWithStaticAbstractMembers<TSelf>
    where TSelf : IInterfaceWithStaticAbstractMembers<TSelf>
{
    static abstract TSelf StaticAbstractFactory();

    static abstract int StaticAbstractProperty { get; }

    static abstract TSelf operator +(TSelf left, TSelf right);

    static abstract implicit operator TSelf(int value);

    static virtual string StaticVirtualMethod() => nameof(TSelf);
}

public interface IGenericInterface<T>
{
    T GetValue();
}

public interface IGenericInterfaceWithTwoParameters<TKey, TValue>
{
    TValue Lookup(TKey key);
}

public interface ICovariantInterface<out T>
{
    T Produce();
}

public interface IContravariantInterface<in T>
{
    void Consume(T item);
}

public interface IInterfaceWithGenericMethod
{
    T GenericMethodInInterface<T>(T value);
}

public partial interface IPartialInterface
{
    void MethodInFirstPart();
}

public partial interface IPartialInterface
{
    void MethodInSecondPart();
}

public interface IInterfaceWithAccessibilityOnDefaultMembers
{
    void PublicMethodCallingPrivate() => PrivateHelperMethod();

    private void PrivateHelperMethod() { }

    protected void ProtectedMethodInInterface() { }

    internal void InternalMethodInInterface() { }

    sealed void SealedDefaultMethod() { }

    virtual void ExplicitlyVirtualDefaultMethod() { }

    abstract void ExplicitlyAbstractMethod();
}

public unsafe interface IUnsafeInterface
{
    int* PointerReturningMethod();
}
