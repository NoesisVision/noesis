using NoesisVision.Annotations.Domain.DDD;

// Calls through an interface: a block interface with block, non-block and explicit
// implementors; a non-block interface; a default member; a member satisfied by a base
// class; overloads that implement two interfaces.
namespace CSharpSyntax.Projection.Invocations;

[DddDomainService]
public interface BlockInterface
{
    void Contract();
}

[DddDomainService]
public class BlockImplementorA : BlockInterface
{
    public void Contract() => Reached.ByBlockImplementorA();
}

[DddDomainService]
public class BlockImplementorB : BlockInterface
{
    public void Contract() => Reached.ByBlockImplementorB();
}

/// <summary>A block whose implementation is explicit, so not public.</summary>
[DddDomainService]
public class ExplicitBlockImplementor : BlockInterface
{
    void BlockInterface.Contract() => Reached.ByExplicitBlockImplementor();
}

public class NonBlockImplementor : BlockInterface
{
    public void Contract() => Reached.ByNonBlockImplementor();
}

public class ExplicitNonBlockImplementor : BlockInterface
{
    void BlockInterface.Contract() => Reached.ByExplicitNonBlockImplementor();
}

[DddApplicationService]
public class CallsThroughBlockInterface(BlockInterface fromPrimaryConstructor)
{
    private readonly BlockInterface _field = fromPrimaryConstructor;

    public void ViaParameter(BlockInterface contract) => contract.Contract();

    public void ViaField() => _field.Contract();

    public void ViaBlockImplementor(BlockImplementorA implementor) => implementor.Contract();

    public void ViaNonBlockImplementor(NonBlockImplementor implementor) => implementor.Contract();

    public void ViaCastToInterface(ExplicitNonBlockImplementor implementor) => ((BlockInterface)implementor).Contract();
}

public interface NonBlockInterface
{
    void Contract();
}

[DddDomainService]
public class NonBlockInterfaceImplementorA : NonBlockInterface
{
    public void Contract() => Reached.ByNonBlockInterfaceImplementorA();
}

[DddDomainService]
public class NonBlockInterfaceImplementorB : NonBlockInterface
{
    public void Contract() => Reached.ByNonBlockInterfaceImplementorB();
}

[DddApplicationService]
public class CallsThroughNonBlockInterface
{
    public void Via(NonBlockInterface contract) => contract.Contract();
}

[DddDomainService]
public interface InterfaceWithDefaultMember
{
    void Required();

    void WithDefaultBody() => Required();
}

[DddDomainService]
public class ImplementsRequiredMemberOnly : InterfaceWithDefaultMember
{
    public void Required() => Reached.ByRequiredMember();
}

[DddApplicationService]
public class CallsDefaultMember
{
    public void Via(InterfaceWithDefaultMember contract) => contract.WithDefaultBody();
}

public class NonBlockBaseProvidingMember
{
    public void Provided() => Reached.ByBaseProvidedMember();
}

[DddDomainService]
public interface ContractSatisfiedByBase
{
    void Provided();
}

/// <summary>The interface member is satisfied by the base class's method.</summary>
[DddDomainService]
public class SatisfiedByBaseMember : NonBlockBaseProvidingMember, ContractSatisfiedByBase;

[DddDomainService]
public interface FirstContract
{
    void ApplyOn(ModifierA modifier);
}

[DddDomainService]
public interface SecondContract
{
    void ApplyOn(ModifierB modifier);
}

/// <summary>Overloads that implement members of two different interfaces.</summary>
[DddDomainService]
public class ImplementsTwoContracts : FirstContract, SecondContract
{
    public void ApplyOn(ModifierA modifier) => Reached.ByFirstContract();

    public void ApplyOn(ModifierB modifier) => Reached.BySecondContract();
}
