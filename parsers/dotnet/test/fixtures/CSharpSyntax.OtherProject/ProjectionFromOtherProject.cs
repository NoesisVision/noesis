using NoesisVision.Annotations.Domain.DDD;

// A block and a step in the other artifact: a chain from CSharpSyntax crosses into it.
namespace CSharpSyntax.OtherProject.Projection;

[DddDomainService]
public class BlockFromOtherProject
{
    public void Target() { }
}

public static class StepFromOtherProject
{
    public static void Forward() => new BlockFromOtherProject().Target();
}
