using CSharpSyntax.OtherProject;
using CSharpSyntax.Types;
using BaseClassAlias = CSharpSyntax.Inheritance.BaseClass;

namespace CSharpSyntax.Inheritance;

public class BaseClass
{
    protected BaseClass() { }

    public BaseClass(int value) => VirtualProperty = value;

    public virtual string VirtualMethod() => nameof(BaseClass);

    public virtual int VirtualProperty { get; set; }

    public virtual int this[int index] => index;

    public virtual event EventHandler? VirtualEvent;

    public void NonVirtualMethod() { }

    public int NonVirtualProperty { get; set; }

    public virtual BaseClass CovariantReturnMethod() => this;

    public virtual BaseClass CovariantReturnProperty => this;

    protected virtual void ProtectedVirtualMethod() { }

    protected internal virtual void ProtectedInternalVirtualMethod() { }

    private protected virtual void PrivateProtectedVirtualMethod() { }

    internal virtual void InternalVirtualMethod() { }

    public virtual T VirtualGenericMethod<T>(T value) => value;

    public virtual T? VirtualGenericMethodWithNullable<T>(T? value) => value;

    public class NestedTypeToHide;

    public override string ToString() => nameof(BaseClass);

    public override bool Equals(object? obj) => ReferenceEquals(this, obj);

    public override int GetHashCode() => 0;
}

public class DerivedClass : BaseClass
{
    public DerivedClass() : base() { }

    public DerivedClass(int value) : base(value) { }

    public DerivedClass(int value, string ignored) : this(value) { }

    public DerivedClass(string named) : base(value: named.Length) { }

    public override string VirtualMethod() => base.VirtualMethod() + nameof(DerivedClass);

    public override int VirtualProperty
    {
        get => base.VirtualProperty;
        set => base.VirtualProperty = value;
    }

    public override int this[int index] => base[index] * 2;

    public override event EventHandler? VirtualEvent;

    public new void NonVirtualMethod() => base.NonVirtualMethod();

    public new int NonVirtualProperty { get; set; }

    public override DerivedClass CovariantReturnMethod() => this;

    public override DerivedClass CovariantReturnProperty => this;

    protected override void ProtectedVirtualMethod() => base.ProtectedVirtualMethod();

    protected internal override void ProtectedInternalVirtualMethod() { }

    private protected override void PrivateProtectedVirtualMethod() { }

    internal override void InternalVirtualMethod() { }

    public override T VirtualGenericMethod<T>(T value) => base.VirtualGenericMethod(value);

    public override T? VirtualGenericMethodWithNullable<T>(T? value) where T : default => value;

    public new class NestedTypeToHide;

    public override string ToString() => base.ToString() + nameof(DerivedClass);
}

public class SecondLevelDerivedClass : DerivedClass
{
    public sealed override string VirtualMethod() => nameof(SecondLevelDerivedClass);

    public sealed override int VirtualProperty { get; set; }
}

public class ThirdLevelDerivedClass : SecondLevelDerivedClass;

public sealed class SealedDerivedClass : BaseClass;

public class DerivedClassWithImplicitHiding : BaseClass
{
    // Hides without the `new` modifier (warning CS0114, suppressed in Directory.Build.props).
    public string VirtualMethod() => nameof(DerivedClassWithImplicitHiding);
}

public class DerivedClassWithPrimaryConstructor(int value) : BaseClass(value);

public class DerivedClassWithPrimaryConstructorAndExplicitConstructor(int value) : BaseClass(value)
{
    public DerivedClassWithPrimaryConstructorAndExplicitConstructor() : this(0) { }
}

public class DerivedClassWithFinalizer : BaseClass
{
    ~DerivedClassWithFinalizer()
    {
    }
}

public class DerivedFromTypeAlias : BaseClassAlias;

public class DerivedFromFullyQualifiedName : CSharpSyntax.Inheritance.BaseClass;

public class DerivedFromGlobalQualifiedName : global::CSharpSyntax.Inheritance.BaseClass;

public class DerivedFromFrameworkType : System.Collections.ObjectModel.Collection<int>;

public class DerivedFromException : Exception
{
    public DerivedFromException() { }

    public DerivedFromException(string message) : base(message) { }

    public DerivedFromException(string message, Exception inner) : base(message, inner) { }
}

public class DerivedFromOtherProjectClass : AbstractBaseClassFromOtherProject
{
    public override void AbstractMethodFromOtherProject() { }
}

public class DerivedFromNestedClass : OuterClassWithNestedTypes.PublicNestedClass;

public class OuterClassWithNestedDerivingFromOuter
{
    public class NestedDerivedFromOuter : OuterClassWithNestedDerivingFromOuter;
}

public partial class PartialDerivedClass : BaseClass;

public partial class PartialDerivedClass
{
    public override string VirtualMethod() => nameof(PartialDerivedClass);
}

public class BaseClassWithProtectedConstructorOnly
{
    protected BaseClassWithProtectedConstructorOnly() { }
}

public class DerivedViaProtectedConstructor : BaseClassWithProtectedConstructorOnly;

public class BaseClassWithStaticMembers
{
    public static int StaticFieldOnBase;

    public static void StaticMethodOnBase() { }
}

public class DerivedClassUsingInheritedStatics : BaseClassWithStaticMembers
{
    public int ReadInheritedStaticField() => StaticFieldOnBase;

    public void CallInheritedStaticMethod() => StaticMethodOnBase();
}

public class BaseClassWithRequiredMember
{
    public required int RequiredOnBase { get; init; }
}

public class DerivedClassWithRequiredMember : BaseClassWithRequiredMember
{
    public required int RequiredOnDerived { get; init; }
}

public class SelfReferencingGenericBase<TSelf> where TSelf : SelfReferencingGenericBase<TSelf>
{
    public TSelf Self => (TSelf)this;
}

public class DerivedFromSelfReferencingGeneric : SelfReferencingGenericBase<DerivedFromSelfReferencingGeneric>;

public class BaseClassCalledFromDerivedWithBaseKeyword
{
    public virtual int Compute() => 1;
}

public class DerivedCallingBaseInsideLambda : BaseClassCalledFromDerivedWithBaseKeyword
{
    public override int Compute()
    {
        Func<int> viaBase = () => base.Compute();
        return viaBase();
    }
}
