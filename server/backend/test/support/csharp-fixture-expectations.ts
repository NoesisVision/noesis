/*
 * What the projection makes of the C# fixture solution under
 * scanners/dotnet/test/fixtures (its annotated part is CSharpSyntax/Projection
 * and CSharpSyntax.OtherProject/ProjectionFromOtherProject.cs). Shared by the
 * unit test over the golden code model and the e2e test over a real scan.
 *
 * `INVOKES` is the expected `invokes` of every behaviour declared under
 * CSharpSyntax/Projection/Invocations, by the rules of section 11 of
 * docs/plans/code-model-to-system-model.md as they stand today. Entries that
 * pin a known gap say so, so the test that flips when the gap is closed is
 * easy to find.
 */

const INVOCATIONS = 'Projection.Invocations';

/** A behaviour of the Invocations module. */
export const behaviour = (name: string): string =>
  `behavior|${INVOCATIONS}.${name}`;

/** One of the leaf behaviours every chain ends at. */
const reached = (name: string): string => behaviour(`Reached.${name}`);

/**
 * Expected `invokes` by behaviour id, for every behaviour under
 * Projection.Invocations except the leaves (`Reached.*`), which invoke nothing.
 */
export const INVOKES: Record<string, string[]> = {
  // --- InterfaceDispatch.cs ------------------------------------------------
  // A call through a block interface reaches the interface's behaviour, and
  // nothing below it: the walk never goes down to the implementors.
  [behaviour('CallsThroughBlockInterface.ViaParameter')]: [
    behaviour('BlockInterface.Contract'),
  ],
  [behaviour('CallsThroughBlockInterface.ViaField')]: [
    behaviour('BlockInterface.Contract'),
  ],
  [behaviour('CallsThroughBlockInterface.ViaCastToInterface')]: [
    behaviour('BlockInterface.Contract'),
  ],
  // A call on a block implementor reaches its own behaviour and, upwards, the
  // interface's (R11.2).
  [behaviour('CallsThroughBlockInterface.ViaBlockImplementor')]: [
    behaviour('BlockImplementorA.Contract'),
    behaviour('BlockInterface.Contract'),
  ],
  // A call on a non-block implementor resolves upwards to the interface's.
  [behaviour('CallsThroughBlockInterface.ViaNonBlockImplementor')]: [
    behaviour('BlockInterface.Contract'),
  ],
  // R11.1: every implementor's calls are attributed to the interface
  // behaviour, block implementors and explicit implementations included.
  [behaviour('BlockInterface.Contract')]: [
    reached('ByBlockImplementorA'),
    reached('ByBlockImplementorB'),
    reached('ByExplicitBlockImplementor'),
    reached('ByExplicitNonBlockImplementor'),
    reached('ByNonBlockImplementor'),
  ],
  [behaviour('BlockImplementorA.Contract')]: [reached('ByBlockImplementorA')],
  [behaviour('BlockImplementorB.Contract')]: [reached('ByBlockImplementorB')],
  // Known gap: an interface that is no block has a bodiless member with no
  // outgoing calls, so the walk ends there and the implementors are invisible.
  [behaviour('CallsThroughNonBlockInterface.Via')]: [],
  [behaviour('NonBlockInterfaceImplementorA.Contract')]: [
    reached('ByNonBlockInterfaceImplementorA'),
  ],
  [behaviour('NonBlockInterfaceImplementorB.Contract')]: [
    reached('ByNonBlockInterfaceImplementorB'),
  ],
  // A default interface member is a behaviour with a body of its own.
  [behaviour('CallsDefaultMember.Via')]: [
    behaviour('InterfaceWithDefaultMember.WithDefaultBody'),
  ],
  [behaviour('InterfaceWithDefaultMember.WithDefaultBody')]: [
    behaviour('InterfaceWithDefaultMember.Required'),
  ],
  [behaviour('InterfaceWithDefaultMember.Required')]: [
    reached('ByRequiredMember'),
  ],
  [behaviour('ImplementsRequiredMemberOnly.Required')]: [
    reached('ByRequiredMember'),
  ],
  // The interface member is satisfied by a non-block base class's method:
  // its calls land on the interface behaviour; the block has no behaviour of
  // its own for it.
  [behaviour('ContractSatisfiedByBase.Provided')]: [
    reached('ByBaseProvidedMember'),
  ],
  // Overloads collapse into one behaviour (R9.3) whose invokes is the union,
  // although they implement members of two different interfaces.
  [behaviour('ImplementsTwoContracts.ApplyOn')]: [
    reached('ByFirstContract'),
    reached('BySecondContract'),
  ],
  [behaviour('FirstContract.ApplyOn')]: [reached('ByFirstContract')],
  [behaviour('SecondContract.ApplyOn')]: [reached('BySecondContract')],

  // --- BaseClassDispatch.cs ------------------------------------------------
  [behaviour('CallsThroughBase.Template')]: [
    behaviour('BlockBase.TemplateMethod'),
  ],
  [behaviour('CallsThroughBase.Virtual')]: [
    behaviour('BlockBase.VirtualWithBody'),
  ],
  [behaviour('CallsThroughBase.Hook')]: [behaviour('BlockBase.PublicHook')],
  [behaviour('CallsThroughBase.OverrideOnDerived')]: [
    behaviour('BlockBase.PublicHook'),
    behaviour('BlockDerivedA.PublicHook'),
  ],
  [behaviour('CallsThroughBase.NonVirtualOnDerived')]: [
    behaviour('BlockBase.NonVirtual'),
  ],
  // The template method reaches the public abstract hook, a behaviour. The
  // protected hook is no behaviour and has no body: known gap, the calls made
  // by its overrides (Reached.By*ProtectedHook) are attributed to nothing.
  [behaviour('BlockBase.TemplateMethod')]: [behaviour('BlockBase.PublicHook')],
  // R11.1: every override's calls are attributed to the abstract behaviour,
  // through a non-block intermediate too.
  [behaviour('BlockBase.PublicHook')]: [
    reached('ByDerivedAPublicHook'),
    reached('ByDerivedBPublicHook'),
    reached('ByDerivedThroughIntermediate'),
    reached('ByIntermediatePublicHook'),
    reached('ByNonBlockDerivedPublicHook'),
  ],
  // The virtual's own body, plus what its override adds; `base.VirtualWithBody()`
  // resolves to the behaviour itself and is dropped (R11.3).
  [behaviour('BlockBase.VirtualWithBody')]: [
    reached('ByBaseBody'),
    reached('ByDerivedAVirtual'),
  ],
  [behaviour('BlockBase.NonVirtual')]: [reached('ByBaseOnly')],
  [behaviour('BlockDerivedA.PublicHook')]: [reached('ByDerivedAPublicHook')],
  [behaviour('BlockDerivedA.VirtualWithBody')]: [
    behaviour('BlockBase.VirtualWithBody'),
    reached('ByDerivedAVirtual'),
  ],
  [behaviour('BlockDerivedB.PublicHook')]: [reached('ByDerivedBPublicHook')],
  // `base.PublicHook()` on the non-block intermediate resolves upwards to the
  // abstract behaviour.
  [behaviour('BlockDerivedThroughIntermediate.PublicHook')]: [
    behaviour('BlockBase.PublicHook'),
    reached('ByDerivedThroughIntermediate'),
  ],

  // --- GenericDispatch.cs --------------------------------------------------
  // Known gap: the call on the constrained type parameter resolves to the
  // non-block constraint interface's bodiless member, whatever the type
  // argument (inferred, explicit or open), so the modifiers are invisible.
  [behaviour('ConstrainedGenericSteps.ApplyInferred')]: [],
  [behaviour('ConstrainedGenericSteps.ApplyExplicit')]: [],
  [behaviour('ConstrainedGenericSteps.ApplyOpen')]: [],
  [behaviour('ConstrainedGenericSteps.ApplyDirect')]: [
    behaviour('ModifierA.Modify'),
  ],
  [behaviour('ModifierA.Modify')]: [reached('ByModifierA')],
  [behaviour('ModifierB.Modify')]: [reached('ByModifierB')],
  // A generic block interface has one behaviour whatever the type argument
  // at the call site: closed, open, or cast to two closings.
  [behaviour('CallsThroughGenericInterface.ViaClosed')]: [
    behaviour('GenericBlockInterface.Load'),
  ],
  [behaviour('CallsThroughGenericInterface.ViaOpen')]: [
    behaviour('GenericBlockInterface.Load'),
  ],
  [behaviour('CallsThroughGenericInterface.ViaImplementedTwice')]: [
    behaviour('GenericBlockInterface.Load'),
  ],
  [behaviour('CallsThroughGenericInterface.ViaClosedImplementor')]: [
    behaviour('ClosedImplementor.Load'),
    behaviour('GenericBlockInterface.Load'),
  ],
  [behaviour('CallsThroughGenericInterface.ViaOpenImplementorClosed')]: [
    behaviour('GenericBlockInterface.Load'),
    behaviour('OpenImplementor.Load'),
  ],
  [behaviour('GenericBlockInterface.Load')]: [
    reached('ByClosedImplementor'),
    reached('ByImplementedTwiceA'),
    reached('ByImplementedTwiceB'),
    reached('ByOpenImplementor'),
  ],
  [behaviour('ClosedImplementor.Load')]: [reached('ByClosedImplementor')],
  [behaviour('OpenImplementor.Load')]: [reached('ByOpenImplementor')],
  // A static abstract member called through the type parameter.
  [behaviour('CallsThroughTypeParameter.Create')]: [
    behaviour('StaticAbstractBlockInterface.Create'),
  ],
  [behaviour('CallsThroughTypeParameter.CreateConcrete')]: [
    behaviour('CreatedViaStaticAbstract.Create'),
    behaviour('StaticAbstractBlockInterface.Create'),
  ],
  [behaviour('StaticAbstractBlockInterface.Create')]: [
    reached('ByStaticAbstractImplementor'),
  ],
  [behaviour('CreatedViaStaticAbstract.Create')]: [
    reached('ByStaticAbstractImplementor'),
  ],

  // --- CallChains.cs -------------------------------------------------------
  [behaviour('CallChains.ThreeStepsDeep')]: [reached('ByThreeSteps')],
  [behaviour('CallChains.ThroughGenericStep')]: [
    behaviour('ModifierA.Modify'),
    reached('ByGenericStep'),
  ],
  [behaviour('CallChains.ThroughCycle')]: [reached('ByCycle')],
  // Steps may pass through an excluded namespace and another artifact.
  [behaviour('CallChains.ThroughExcludedNamespace')]: [
    reached('ByExcludedStep'),
  ],
  [behaviour('CallChains.ThroughOtherProject')]: [
    'behavior|OtherProject.Projection.BlockFromOtherProject.Target',
  ],
  [behaviour('CallChains.ThroughAwaitedStep')]: [reached('ByAwaitedStep')],
  // Calls inside lambdas and local functions belong to the enclosing method.
  [behaviour('CallChains.ThroughLambda')]: [
    behaviour('ModifierA.Modify'),
    reached('ByLambda'),
  ],
  [behaviour('CallChains.ThroughLocalFunction')]: [reached('ByLocalFunction')],
  // R11.4: a constructor ends the walk, whatever its body calls.
  [behaviour('CallChains.ThroughConstructor')]: [],
  // R11.3: the overload is the same behaviour and is dropped.
  [behaviour('CallChains.CallsOwnOverload')]: [reached('ByOverload')],
  [behaviour('CallChains.MutualA')]: [behaviour('CallChains.MutualB')],
  [behaviour('CallChains.MutualB')]: [behaviour('CallChains.MutualA')],
  // Known gaps in the scanner: a delegate invocation and a user-defined
  // operator call produce no INVOKES edge yet.
  [behaviour('CallChains.ThroughDelegateField')]: [],
  [behaviour('CallChains.ThroughOperator')]: [],
  [behaviour('OperatorBlock.Add')]: [reached('ByOperatorBody')],
  // An annotated private method is a behaviour: the walk stops at it.
  [behaviour('CallChains.CallsPrivateBehaviour')]: [
    behaviour('CallChains.Private behaviour'),
  ],
  [behaviour('CallChains.Private behaviour')]: [reached('ByPrivateBehaviour')],
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
  'module|Projection.Behaviours',
  'module|Projection.Blocks',
  'module|Projection.Invocations',
];
