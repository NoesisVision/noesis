using NoesisVision.Annotations.Domain.DDD;

// The behaviors every invocation chain in this folder ends at: one per chain, so the
// expected `invokes` of each caller names exactly what reached it.
namespace CSharpSyntax.Projection.Invocations;

[DddDomainService]
public static class Reached
{
    // InterfaceDispatch.cs
    public static void ByBlockImplementorA() { }
    public static void ByBlockImplementorB() { }
    public static void ByExplicitBlockImplementor() { }
    public static void ByNonBlockImplementor() { }
    public static void ByExplicitNonBlockImplementor() { }
    public static void ByNonBlockInterfaceImplementorA() { }
    public static void ByNonBlockInterfaceImplementorB() { }
    public static void ByRequiredMember() { }
    public static void ByBaseProvidedMember() { }
    public static void ByFirstContract() { }
    public static void BySecondContract() { }

    // BaseClassDispatch.cs
    public static void ByBaseBody() { }
    public static void ByBaseOnly() { }
    public static void ByDerivedAPublicHook() { }
    public static void ByDerivedAProtectedHook() { }
    public static void ByDerivedAVirtual() { }
    public static void ByDerivedBPublicHook() { }
    public static void ByDerivedBProtectedHook() { }
    public static void ByNonBlockDerivedPublicHook() { }
    public static void ByNonBlockDerivedProtectedHook() { }
    public static void ByIntermediatePublicHook() { }
    public static void ByDerivedThroughIntermediate() { }

    // GenericDispatch.cs
    public static void ByModifierA() { }
    public static void ByModifierB() { }
    public static void ByClosedImplementor() { }
    public static void ByOpenImplementor() { }
    public static void ByImplementedTwiceA() { }
    public static void ByImplementedTwiceB() { }
    public static void ByStaticAbstractImplementor() { }

    // CallChains.cs
    public static void ByThreeSteps() { }
    public static void ByGenericStep() { }
    public static void ByCycle() { }
    public static void ByExcludedStep() { }
    public static void ByAwaitedStep() { }
    public static void ByLambda() { }
    public static void ByLocalFunction() { }
    public static void ByConstructor() { }
    public static void ByOverload() { }
    public static void ByDelegate() { }
    public static void ByOperatorBody() { }
    public static void ByPropertyGetter() { }
    public static int ByFieldInitializer() => 0;
    public static void ByPrivateBehavior() { }
}
