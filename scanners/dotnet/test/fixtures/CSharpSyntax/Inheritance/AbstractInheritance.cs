namespace CSharpSyntax.Inheritance;

public abstract class AbstractBaseWithAllMemberKinds
{
    public abstract void AbstractMethod();

    public abstract int AbstractProperty { get; }

    public abstract int AbstractPropertyWithSetter { get; set; }

    public abstract int this[int index] { get; }

    public abstract event EventHandler AbstractEvent;

    protected abstract void ProtectedAbstractMethod();

    public virtual void VirtualMethodWithDefaultBody() { }

    public abstract T AbstractGenericMethod<T>(T value);

}

public abstract class AbstractIntermediate : AbstractBaseWithAllMemberKinds
{
    public override void AbstractMethod() { }

    // Re-abstracts an inherited virtual member.
    public abstract override void VirtualMethodWithDefaultBody();
}

public class ConcreteFromAbstractIntermediate : AbstractIntermediate
{
    private int _backing;

    public override int AbstractProperty => _backing;

    public override int AbstractPropertyWithSetter
    {
        get => _backing;
        set => _backing = value;
    }

    public override int this[int index] => index;

    public override event EventHandler? AbstractEvent;

    protected override void ProtectedAbstractMethod() { }

    public override void VirtualMethodWithDefaultBody() { }

    public override T AbstractGenericMethod<T>(T value) => value;
}

public abstract class AbstractClassWithConstructor
{
    protected AbstractClassWithConstructor(int value) => Value = value;

    public int Value { get; }
}

public class ConcreteCallingAbstractConstructor : AbstractClassWithConstructor
{
    public ConcreteCallingAbstractConstructor() : base(1) { }
}

public abstract class AbstractClassWithPrimaryConstructor(int value)
{
    public int Value => value;
}

public class ConcreteFromAbstractWithPrimaryConstructor(int value) : AbstractClassWithPrimaryConstructor(value);
