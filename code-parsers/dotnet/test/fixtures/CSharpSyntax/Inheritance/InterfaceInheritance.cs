using CSharpSyntax.Types;

namespace CSharpSyntax.Inheritance;

public interface IBaseInterface
{
    void BaseInterfaceMethod();
}

public interface ISecondBaseInterface
{
    void SecondBaseInterfaceMethod();
}

public interface IDerivedInterface : IBaseInterface
{
    void DerivedInterfaceMethod();
}

public interface IDerivedFromTwoInterfaces : IBaseInterface, ISecondBaseInterface;

public interface IThirdLevelInterface : IDerivedInterface, IDerivedFromTwoInterfaces
{
    void ThirdLevelMethod();
}

public interface IDerivedInterfaceOverridingDefaultImplementation : IInterfaceWithDefaultMethod
{
    // Interface re-implements a base interface's default method.
    void IInterfaceWithDefaultMethod.MethodWithDefaultBody()
    {
    }
}

public interface IDerivedInterfaceHidingMember : IBaseInterface
{
    new void BaseInterfaceMethod();
}

public interface IGenericDerivedInterface<T> : IGenericInterface<T> where T : struct;

public interface IDerivedFromClosedGenericInterface : IGenericInterface<int>;

public interface IDerivedFromFrameworkInterfaces : IDisposable, IComparable<IDerivedFromFrameworkInterfaces>;

public interface IDerivedInterfaceAddingStaticAbstract<TSelf> : IInterfaceWithStaticAbstractMembers<TSelf>
    where TSelf : IDerivedInterfaceAddingStaticAbstract<TSelf>
{
    static abstract TSelf AdditionalFactory();
}
