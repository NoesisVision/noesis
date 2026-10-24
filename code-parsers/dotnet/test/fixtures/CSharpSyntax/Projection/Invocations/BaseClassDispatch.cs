using NoesisVision.Annotations.Domain.DDD;

// Calls through a base class: a template method, public and protected abstract hooks,
// a virtual with a body, block and non-block derivations, a non-block intermediate.
namespace CSharpSyntax.Projection.Invocations;

[DddAggregate]
public abstract class BlockBase
{
    public void TemplateMethod()
    {
        PublicHook();
        ProtectedHook();
    }

    public abstract void PublicHook();

    protected abstract void ProtectedHook();

    public virtual void VirtualWithBody() => Reached.ByBaseBody();

    public void NonVirtual() => Reached.ByBaseOnly();
}

[DddAggregate]
public class BlockDerivedA : BlockBase
{
    public override void PublicHook() => Reached.ByDerivedAPublicHook();

    protected override void ProtectedHook() => Reached.ByDerivedAProtectedHook();

    public override void VirtualWithBody()
    {
        base.VirtualWithBody();
        Reached.ByDerivedAVirtual();
    }
}

[DddAggregate]
public class BlockDerivedB : BlockBase
{
    public override void PublicHook() => Reached.ByDerivedBPublicHook();

    protected override void ProtectedHook() => Reached.ByDerivedBProtectedHook();
}

public class NonBlockDerived : BlockBase
{
    public override void PublicHook() => Reached.ByNonBlockDerivedPublicHook();

    protected override void ProtectedHook() => Reached.ByNonBlockDerivedProtectedHook();
}

public abstract class NonBlockIntermediate : BlockBase
{
    public override void PublicHook() => Reached.ByIntermediatePublicHook();
}

[DddAggregate]
public class BlockDerivedThroughIntermediate : NonBlockIntermediate
{
    public override void PublicHook()
    {
        base.PublicHook();
        Reached.ByDerivedThroughIntermediate();
    }

    protected override void ProtectedHook() { }
}

[DddApplicationService]
public class CallsThroughBase
{
    public void Template(BlockBase block) => block.TemplateMethod();

    public void Virtual(BlockBase block) => block.VirtualWithBody();

    public void Hook(BlockBase block) => block.PublicHook();

    public void OverrideOnDerived(BlockDerivedA derived) => derived.PublicHook();

    public void NonVirtualOnDerived(BlockDerivedA derived) => derived.NonVirtual();
}
