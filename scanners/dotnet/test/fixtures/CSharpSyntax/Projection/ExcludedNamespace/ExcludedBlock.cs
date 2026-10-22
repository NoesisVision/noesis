using CSharpSyntax.Projection.Invocations;
using NoesisVision.Annotations.Domain.DDD;

// Excluded by .noesis/settings.json: no block, no module; a chain still walks through it.
namespace CSharpSyntax.Projection.ExcludedNamespace;

[DddDomainService]
public class ExcludedBlock
{
    public void Run() { }

    public static void StepThroughExcluded() => Reached.ByExcludedStep();
}
