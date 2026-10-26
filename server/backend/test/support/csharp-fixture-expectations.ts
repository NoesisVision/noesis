/*
 * What the projection makes of the C# fixture solution under
 * code-parsers/dotnet/test/fixtures (its annotated part is CSharpSyntax/Projection
 * and CSharpSyntax.OtherProject/ProjectionFromOtherProject.cs). Shared by the
 * unit test over the golden code model and the e2e test over a real scan.
 *
 * `INVOKES` is the expected `invokes` of every behavior declared under
 * CSharpSyntax/Projection/Invocations, by the rules of section 11 of
 * docs/plans/code-model-to-system-model.md as they stand today. Entries that
 * pin a known gap say so, so the test that flips when the gap is closed is
 * easy to find.
 */

const INVOCATIONS = 'Projection.Invocations';

/** A behavior of the Invocations module. */
export const behavior = (name: string): string =>
  `behavior|${INVOCATIONS}.${name}`;

/** One of the leaf behaviors every chain ends at. */
const reached = (name: string): string => behavior(`Reached.${name}`);

/**
 * Expected `invokes` by behavior id, for every behavior under
 * Projection.Invocations except the leaves (`Reached.*`), which invoke nothing.
 */
export const INVOKES: Record<string, string[]> = {
  // --- InterfaceDispatch.cs ------------------------------------------------
  // A call through a block interface reaches the interface's behavior, and
  // nothing below it: the walk never goes down to the implementors.
  [behavior('CallsThroughBlockInterface.ViaParameter')]: [
    behavior('BlockInterface.Contract'),
  ],
  [behavior('CallsThroughBlockInterface.ViaField')]: [
    behavior('BlockInterface.Contract'),
  ],
  [behavior('CallsThroughBlockInterface.ViaCastToInterface')]: [
    behavior('BlockInterface.Contract'),
  ],
  // A call on a block implementor reaches its own behavior and, upwards, the
  // interface's (R11.2).
  [behavior('CallsThroughBlockInterface.ViaBlockImplementor')]: [
    behavior('BlockImplementorA.Contract'),
    behavior('BlockInterface.Contract'),
  ],
  // A call on a non-block implementor resolves upwards to the interface's.
  [behavior('CallsThroughBlockInterface.ViaNonBlockImplementor')]: [
    behavior('BlockInterface.Contract'),
  ],
  // R11.1: every implementor's calls are attributed to the interface
  // behavior, block implementors and explicit implementations included.
  [behavior('BlockInterface.Contract')]: [
    reached('ByBlockImplementorA'),
    reached('ByBlockImplementorB'),
    reached('ByExplicitBlockImplementor'),
    reached('ByExplicitNonBlockImplementor'),
    reached('ByNonBlockImplementor'),
  ],
  [behavior('BlockImplementorA.Contract')]: [reached('ByBlockImplementorA')],
  [behavior('BlockImplementorB.Contract')]: [reached('ByBlockImplementorB')],
  // Known gap: an interface that is no block has a bodiless member with no
  // outgoing calls, so the walk ends there and the implementors are invisible.
  [behavior('CallsThroughNonBlockInterface.Via')]: [],
  [behavior('NonBlockInterfaceImplementorA.Contract')]: [
    reached('ByNonBlockInterfaceImplementorA'),
  ],
  [behavior('NonBlockInterfaceImplementorB.Contract')]: [
    reached('ByNonBlockInterfaceImplementorB'),
  ],
  // A default interface member is a behavior with a body of its own.
  [behavior('CallsDefaultMember.Via')]: [
    behavior('InterfaceWithDefaultMember.WithDefaultBody'),
  ],
  [behavior('InterfaceWithDefaultMember.WithDefaultBody')]: [
    behavior('InterfaceWithDefaultMember.Required'),
  ],
  [behavior('InterfaceWithDefaultMember.Required')]: [
    reached('ByRequiredMember'),
  ],
  [behavior('ImplementsRequiredMemberOnly.Required')]: [
    reached('ByRequiredMember'),
  ],
  // The interface member is satisfied by a non-block base class's method:
  // its calls land on the interface behavior; the block has no behavior of
  // its own for it.
  [behavior('ContractSatisfiedByBase.Provided')]: [
    reached('ByBaseProvidedMember'),
  ],
  // Overloads collapse into one behavior (R9.3) whose invokes is the union,
  // although they implement members of two different interfaces.
  [behavior('ImplementsTwoContracts.ApplyOn')]: [
    reached('ByFirstContract'),
    reached('BySecondContract'),
  ],
  [behavior('FirstContract.ApplyOn')]: [reached('ByFirstContract')],
  [behavior('SecondContract.ApplyOn')]: [reached('BySecondContract')],

  // --- BaseClassDispatch.cs ------------------------------------------------
  [behavior('CallsThroughBase.Template')]: [
    behavior('BlockBase.TemplateMethod'),
  ],
  [behavior('CallsThroughBase.Virtual')]: [
    behavior('BlockBase.VirtualWithBody'),
  ],
  [behavior('CallsThroughBase.Hook')]: [behavior('BlockBase.PublicHook')],
  [behavior('CallsThroughBase.OverrideOnDerived')]: [
    behavior('BlockBase.PublicHook'),
    behavior('BlockDerivedA.PublicHook'),
  ],
  [behavior('CallsThroughBase.NonVirtualOnDerived')]: [
    behavior('BlockBase.NonVirtual'),
  ],
  // The template method reaches the public abstract hook, a behavior. The
  // protected hook is no behavior and has no body: known gap, the calls made
  // by its overrides (Reached.By*ProtectedHook) are attributed to nothing.
  [behavior('BlockBase.TemplateMethod')]: [behavior('BlockBase.PublicHook')],
  // R11.1: every override's calls are attributed to the abstract behavior,
  // through a non-block intermediate too.
  [behavior('BlockBase.PublicHook')]: [
    reached('ByDerivedAPublicHook'),
    reached('ByDerivedBPublicHook'),
    reached('ByDerivedThroughIntermediate'),
    reached('ByIntermediatePublicHook'),
    reached('ByNonBlockDerivedPublicHook'),
  ],
  // The virtual's own body, plus what its override adds; `base.VirtualWithBody()`
  // resolves to the behavior itself and is dropped (R11.3).
  [behavior('BlockBase.VirtualWithBody')]: [
    reached('ByBaseBody'),
    reached('ByDerivedAVirtual'),
  ],
  [behavior('BlockBase.NonVirtual')]: [reached('ByBaseOnly')],
  [behavior('BlockDerivedA.PublicHook')]: [reached('ByDerivedAPublicHook')],
  [behavior('BlockDerivedA.VirtualWithBody')]: [
    behavior('BlockBase.VirtualWithBody'),
    reached('ByDerivedAVirtual'),
  ],
  [behavior('BlockDerivedB.PublicHook')]: [reached('ByDerivedBPublicHook')],
  // `base.PublicHook()` on the non-block intermediate resolves upwards to the
  // abstract behavior.
  [behavior('BlockDerivedThroughIntermediate.PublicHook')]: [
    behavior('BlockBase.PublicHook'),
    reached('ByDerivedThroughIntermediate'),
  ],

  // --- GenericDispatch.cs --------------------------------------------------
  // Known gap: the call on the constrained type parameter resolves to the
  // non-block constraint interface's bodiless member, whatever the type
  // argument (inferred, explicit or open), so the modifiers are invisible.
  [behavior('ConstrainedGenericSteps.ApplyInferred')]: [],
  [behavior('ConstrainedGenericSteps.ApplyExplicit')]: [],
  [behavior('ConstrainedGenericSteps.ApplyOpen')]: [],
  [behavior('ConstrainedGenericSteps.ApplyDirect')]: [
    behavior('ModifierA.Modify'),
  ],
  [behavior('ModifierA.Modify')]: [reached('ByModifierA')],
  [behavior('ModifierB.Modify')]: [reached('ByModifierB')],
  // A generic block interface has one behavior whatever the type argument
  // at the call site: closed, open, or cast to two closings.
  [behavior('CallsThroughGenericInterface.ViaClosed')]: [
    behavior('GenericBlockInterface.Load'),
  ],
  [behavior('CallsThroughGenericInterface.ViaOpen')]: [
    behavior('GenericBlockInterface.Load'),
  ],
  [behavior('CallsThroughGenericInterface.ViaImplementedTwice')]: [
    behavior('GenericBlockInterface.Load'),
  ],
  [behavior('CallsThroughGenericInterface.ViaClosedImplementor')]: [
    behavior('ClosedImplementor.Load'),
    behavior('GenericBlockInterface.Load'),
  ],
  [behavior('CallsThroughGenericInterface.ViaOpenImplementorClosed')]: [
    behavior('GenericBlockInterface.Load'),
    behavior('OpenImplementor.Load'),
  ],
  [behavior('GenericBlockInterface.Load')]: [
    reached('ByClosedImplementor'),
    reached('ByImplementedTwiceA'),
    reached('ByImplementedTwiceB'),
    reached('ByOpenImplementor'),
  ],
  [behavior('ClosedImplementor.Load')]: [reached('ByClosedImplementor')],
  [behavior('OpenImplementor.Load')]: [reached('ByOpenImplementor')],
  // A static abstract member called through the type parameter.
  [behavior('CallsThroughTypeParameter.Create')]: [
    behavior('StaticAbstractBlockInterface.Create'),
  ],
  [behavior('CallsThroughTypeParameter.CreateConcrete')]: [
    behavior('CreatedViaStaticAbstract.Create'),
    behavior('StaticAbstractBlockInterface.Create'),
  ],
  [behavior('StaticAbstractBlockInterface.Create')]: [
    reached('ByStaticAbstractImplementor'),
  ],
  [behavior('CreatedViaStaticAbstract.Create')]: [
    reached('ByStaticAbstractImplementor'),
  ],

  // --- CallChains.cs -------------------------------------------------------
  [behavior('CallChains.ThreeStepsDeep')]: [reached('ByThreeSteps')],
  [behavior('CallChains.ThroughGenericStep')]: [
    behavior('ModifierA.Modify'),
    reached('ByGenericStep'),
  ],
  [behavior('CallChains.ThroughCycle')]: [reached('ByCycle')],
  // Steps may pass through an excluded namespace and another artifact.
  [behavior('CallChains.ThroughExcludedNamespace')]: [
    reached('ByExcludedStep'),
  ],
  [behavior('CallChains.ThroughOtherProject')]: [
    'behavior|OtherProject.Projection.BlockFromOtherProject.Target',
  ],
  [behavior('CallChains.ThroughAwaitedStep')]: [reached('ByAwaitedStep')],
  // Calls inside lambdas and local functions belong to the enclosing method.
  [behavior('CallChains.ThroughLambda')]: [
    behavior('ModifierA.Modify'),
    reached('ByLambda'),
  ],
  [behavior('CallChains.ThroughLocalFunction')]: [reached('ByLocalFunction')],
  // R11.4: a constructor ends the walk, whatever its body calls.
  [behavior('CallChains.ThroughConstructor')]: [],
  // R11.3: the overload is the same behavior and is dropped.
  [behavior('CallChains.CallsOwnOverload')]: [reached('ByOverload')],
  [behavior('CallChains.MutualA')]: [behavior('CallChains.MutualB')],
  [behavior('CallChains.MutualB')]: [behavior('CallChains.MutualA')],
  // Known gaps in the parser: a delegate invocation and a user-defined
  // operator call produce no INVOKES edge yet.
  [behavior('CallChains.ThroughDelegateField')]: [],
  [behavior('CallChains.ThroughOperator')]: [],
  [behavior('OperatorBlock.Add')]: [reached('ByOperatorBody')],
  // An annotated private method is a behavior: the walk stops at it.
  [behavior('CallChains.CallsPrivateBehavior')]: [
    behavior('CallChains.Private behavior'),
  ],
  [behavior('CallChains.Private behavior')]: [reached('ByPrivateBehavior')],
};

/** Leaves nothing reaches: a call from a property getter or a field initialiser is attributed to nothing (R11.1). */
export const UNREACHED = [
  reached('ByPropertyGetter'),
  reached('ByFieldInitializer'),
  reached('ByDerivedAProtectedHook'),
  reached('ByDerivedBProtectedHook'),
  reached('ByNonBlockDerivedProtectedHook'),
  reached('ByConstructor'),
  reached('ByDelegate'),
];

/** The modules the fixture's .noesis/settings.json maps its namespaces to. */
export const MODULES = [
  'module|OtherProject',
  'module|OtherProject.Projection',
  'module|Projection',
  'module|Projection.Behaviors',
  'module|Projection.Blocks',
  'module|Projection.Invocations',
];
