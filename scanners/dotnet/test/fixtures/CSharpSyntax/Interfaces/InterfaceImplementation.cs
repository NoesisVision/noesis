using System.Collections;
using CSharpSyntax.Inheritance;
using CSharpSyntax.OtherProject;
using CSharpSyntax.Types;
using IInterfaceAlias = CSharpSyntax.Types.IPlainInterface;

namespace CSharpSyntax.Interfaces;

public interface IInterfaceWithAllMemberKinds
{
    void Method();

    int GetOnlyProperty { get; }

    int this[int index] { get; }

    event EventHandler Event;

    T GenericMethod<T>(T value);
}

public class ImplicitImplementation : IInterfaceWithAllMemberKinds
{
    public void Method() { }

    public int GetOnlyProperty => 1;

    public int this[int index] => index;

    public event EventHandler? Event;

    public T GenericMethod<T>(T value) => value;
}

public class ExplicitImplementation : IInterfaceWithAllMemberKinds
{
    void IInterfaceWithAllMemberKinds.Method() { }

    int IInterfaceWithAllMemberKinds.GetOnlyProperty => 1;

    int IInterfaceWithAllMemberKinds.this[int index] => index;

    event EventHandler? IInterfaceWithAllMemberKinds.Event
    {
        add { }
        remove { }
    }

    T IInterfaceWithAllMemberKinds.GenericMethod<T>(T value) => value;
}

public class MixedImplicitAndExplicitImplementation : IInterfaceWithAllMemberKinds
{
    public void Method() { }

    int IInterfaceWithAllMemberKinds.GetOnlyProperty => 1;

    public int this[int index] => index;

    event EventHandler? IInterfaceWithAllMemberKinds.Event
    {
        add { }
        remove { }
    }

    public T GenericMethod<T>(T value) => value;
}

public class ImplementationWithWiderAccessors : IInterfaceWithProperty
{
    // Interface declares get-only; class adds a setter.
    public int GetOnlyProperty { get; set; }

    public int GetSetProperty { get; set; }

    public int GetInitProperty { get; init; }
}

public class VirtualImplementation : IPlainInterface
{
    public virtual void MethodInInterface() { }
}

public class OverriddenInterfaceImplementation : VirtualImplementation
{
    public override void MethodInInterface() { }
}

public abstract class AbstractImplementation : IPlainInterface
{
    public abstract void MethodInInterface();
}

public class ConcreteFromAbstractImplementation : AbstractImplementation
{
    public override void MethodInInterface() { }
}

public class BaseClassProvidingInterfaceMemberWithoutDeclaringInterface
{
    public void MethodInInterface() { }
}

public class ImplementationSatisfiedByBaseClassMember
    : BaseClassProvidingInterfaceMemberWithoutDeclaringInterface, IPlainInterface;

public class ReImplementationInDerivedClass : ImplicitImplementation, IInterfaceWithAllMemberKinds
{
    public new void Method() { }
}

public class MultipleInterfacesImplementation : IPlainInterface, IInterfaceWithProperty, IInterfaceWithIndexer, IInterfaceWithEvent
{
    public void MethodInInterface() { }

    public int GetOnlyProperty => 0;

    public int GetSetProperty { get; set; }

    public int GetInitProperty { get; init; }

    public int this[int index]
    {
        get => index;
        set { }
    }

    public event EventHandler? EventInInterface;
}

public interface IFirstConflictingInterface
{
    string ConflictingName();
}

public interface ISecondConflictingInterface
{
    string ConflictingName();
}

public class ConflictResolvedWithExplicitImplementations : IFirstConflictingInterface, ISecondConflictingInterface
{
    string IFirstConflictingInterface.ConflictingName() => "first";

    string ISecondConflictingInterface.ConflictingName() => "second";
}

public class ConflictResolvedWithSharedImplementation : IFirstConflictingInterface, ISecondConflictingInterface
{
    public string ConflictingName() => "shared";
}

public class ClosedGenericInterfaceImplementation : IGenericInterface<int>
{
    public int GetValue() => 1;
}

public class SameGenericInterfaceImplementedTwice : IGenericInterface<int>, IGenericInterface<string>
{
    int IGenericInterface<int>.GetValue() => 1;

    string IGenericInterface<string>.GetValue() => "";
}

public class OpenGenericInterfaceImplementation<T> : IGenericInterface<T>
{
    public T GetValue() => default!;
}

public class TwoParameterGenericInterfaceImplementation<TKey, TValue> : IGenericInterfaceWithTwoParameters<TKey, TValue>
    where TKey : notnull
{
    public TValue Lookup(TKey key) => default!;
}

public class PartiallyClosedGenericInterfaceImplementation<T> : IGenericInterfaceWithTwoParameters<string, T>
{
    public T Lookup(string key) => default!;
}

public struct GenericStructImplementation<T> : IGenericInterface<T>
{
    public T GetValue() => default!;
}

public record struct GenericRecordStructImplementation<T>(T Value) : IGenericInterface<T>
{
    public T GetValue() => Value;
}

public class DefaultMethodNotOverridden : IInterfaceWithDefaultMethod;

public class DefaultMethodOverridden : IInterfaceWithDefaultMethod
{
    public void MethodWithDefaultBody() { }

    public int PropertyWithDefaultGetter => 2;
}

public struct StructImplementation : IPlainInterface
{
    public void MethodInInterface() { }
}

public readonly struct ReadonlyStructImplementation : IGenericInterface<int>
{
    public int GetValue() => 0;
}

public record RecordImplementation(int Value) : IGenericInterface<int>
{
    public int GetValue() => Value;
}

public record struct RecordStructImplementation(int Value) : IGenericInterface<int>
{
    public int GetValue() => Value;
}

public ref struct RefStructImplementation : IPlainInterface
{
    public void MethodInInterface() { }
}

public class StaticAbstractImplementation : IInterfaceWithStaticAbstractMembers<StaticAbstractImplementation>
{
    public static StaticAbstractImplementation StaticAbstractFactory() => new();

    public static int StaticAbstractProperty => 1;

    public static StaticAbstractImplementation operator +(StaticAbstractImplementation left, StaticAbstractImplementation right) => new();

    public static implicit operator StaticAbstractImplementation(int value) => new();

    public static string StaticVirtualMethod() => nameof(StaticAbstractImplementation);
}

public class ExplicitStaticAbstractImplementation : IInterfaceWithStaticAbstractMembers<ExplicitStaticAbstractImplementation>
{
    static ExplicitStaticAbstractImplementation IInterfaceWithStaticAbstractMembers<ExplicitStaticAbstractImplementation>.StaticAbstractFactory() => new();

    static int IInterfaceWithStaticAbstractMembers<ExplicitStaticAbstractImplementation>.StaticAbstractProperty => 1;

    static ExplicitStaticAbstractImplementation IInterfaceWithStaticAbstractMembers<ExplicitStaticAbstractImplementation>.operator +(
        ExplicitStaticAbstractImplementation left,
        ExplicitStaticAbstractImplementation right) => new();

    static implicit IInterfaceWithStaticAbstractMembers<ExplicitStaticAbstractImplementation>.operator ExplicitStaticAbstractImplementation(int value) => new();
}

public class VarianceImplementation : ICovariantInterface<string>, IContravariantInterface<object>
{
    public string Produce() => "";

    public void Consume(object item) { }
}

public class ExplicitGenericMethodImplementation : IInterfaceWithGenericMethod
{
    T IInterfaceWithGenericMethod.GenericMethodInInterface<T>(T value) => value;
}

public partial class PartialClassImplementation : IPlainInterface;

public partial class PartialClassImplementation : IInterfaceWithProperty
{
    public void MethodInInterface() { }

    public int GetOnlyProperty => 0;

    public int GetSetProperty { get; set; }

    public int GetInitProperty { get; init; }
}

public class PartialInterfaceImplementation : IPartialInterface
{
    public void MethodInFirstPart() { }

    public void MethodInSecondPart() { }
}

public class ImplementationViaInterfaceAlias : IInterfaceAlias
{
    public void MethodInInterface() { }
}

public class ImplementationViaFullyQualifiedInterfaceName : global::CSharpSyntax.Types.IPlainInterface
{
    public void MethodInInterface() { }
}

public class OtherProjectInterfaceImplementation : IInterfaceFromOtherProject
{
    public void MethodFromOtherProjectInterface() { }
}

public class DerivedInterfaceImplementation : IThirdLevelInterface
{
    public void BaseInterfaceMethod() { }

    public void SecondBaseInterfaceMethod() { }

    public void DerivedInterfaceMethod() { }

    public void ThirdLevelMethod() { }
}

public class HidingInterfaceMemberImplementation : IDerivedInterfaceHidingMember
{
    void IBaseInterface.BaseInterfaceMethod() { }

    void IDerivedInterfaceHidingMember.BaseInterfaceMethod() { }
}

public class AccessibilityOnDefaultMembersImplementation : IInterfaceWithAccessibilityOnDefaultMembers
{
    public void ExplicitlyAbstractMethod() { }
}

public class NestedTypeImplementation
{
    public class NestedImplementingInterface : IPlainInterface
    {
        public void MethodInInterface() { }
    }

    private struct PrivateNestedStructImplementingInterface : IPlainInterface
    {
        public void MethodInInterface() { }
    }
}

public class FrameworkInterfacesImplementation
    : IDisposable,
      IAsyncDisposable,
      IEquatable<FrameworkInterfacesImplementation>,
      IComparable<FrameworkInterfacesImplementation>,
      IEnumerable<int>
{
    public void Dispose() { }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    public bool Equals(FrameworkInterfacesImplementation? other) => ReferenceEquals(this, other);

    public int CompareTo(FrameworkInterfacesImplementation? other) => 0;

    public IEnumerator<int> GetEnumerator()
    {
        yield return 1;
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

    public override bool Equals(object? obj) => Equals(obj as FrameworkInterfacesImplementation);

    public override int GetHashCode() => 0;
}

public class InterfaceImplementationUsedThroughGenericConstraint<T> where T : IInterfaceWithStaticAbstractMembers<T>
{
    public T CreateViaStaticAbstract() => T.StaticAbstractFactory();

    public int ReadStaticAbstractProperty() => T.StaticAbstractProperty;

    public T AddViaStaticAbstractOperator(T left, T right) => left + right;
}
