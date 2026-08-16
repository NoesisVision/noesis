import type {
  CodebaseState,
  DesignedActor,
  DesignedActorComparable,
  DesignedBehaviour,
  DesignedBehaviourComparable,
  DesignedBoundedContext,
  DesignedBoundedContextComparable,
  DesignedBuildingBlock,
  DesignedBuildingBlockComparable,
  DesignedDomainModule,
  DesignedDomainModuleComparable,
  DesignedUseCase,
  DesignedUseCaseComparable,
} from './design-doc.js';

/*
 * Codebase-relative state, derived rather than stored (specification §2.6,
 * §14.9, decision 49).
 *
 * The rule has one job: every visible marker means "the source code must change
 * here". So comparison sees only the fields a scanner can populate — name,
 * type, owning application service, actor references, input and output
 * structure. Design-only prose — summary, description, rules, quality
 * attributes, acceptance scenarios, field labels and notes — is excluded by
 * construction, which is why a typo can never light an element up as Modified.
 *
 * State never propagates upward through containment: a new use case leaves its
 * application service and bounded context unmarked. Containment already
 * communicates that, and propagation is how a document ends up all markers.
 */

/** One baseline-comparable field that differs, phrased for the impact summary. */
export type BaselineFieldDiff = {
  readonly field: string;
  readonly from: string;
  readonly to: string;
};

type Comparable = Record<string, unknown>;

type BaselineHolder<C extends Comparable> = {
  readonly scanner: unknown;
  readonly markedForRemoval: boolean;
  readonly baseline: { readonly scanId: string; readonly comparable: C } | null;
};

/*
 * Comparison is structural. Field lists compare in order, because reordering a
 * command's parameters is a source-code change; actor references compare as a
 * set, because the document's actor order is presentation.
 */
const same = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

function stateOf<C extends Comparable>(
  element: BaselineHolder<C>,
  current: C,
): CodebaseState {
  if (element.markedForRemoval) return 'removed';
  if (element.baseline === null) return 'new';
  return same(element.baseline.comparable, current) ? 'existing' : 'modified';
}

function diffOf<C extends Comparable>(
  element: BaselineHolder<C>,
  current: C,
  labels: Readonly<Record<keyof C & string, string>>,
  render: (key: keyof C & string, value: unknown) => string,
): BaselineFieldDiff[] {
  if (element.baseline === null || element.markedForRemoval) return [];
  const before = element.baseline.comparable;
  const diffs: BaselineFieldDiff[] = [];
  for (const key of Object.keys(labels) as (keyof C & string)[]) {
    if (same(before[key], current[key])) continue;
    diffs.push({
      field: labels[key],
      from: render(key, before[key]),
      to: render(key, current[key]),
    });
  }
  return diffs;
}

/* ---------------------------------------------------------------- use case */

const structure = (
  fields: readonly { name: string; type: string }[],
): string =>
  fields.length === 0
    ? 'none'
    : fields.map((field) => `${field.name}: ${field.type}`).join(', ');

/**
 * The baseline-comparable projection of a use case. Actor references are sorted
 * so that reordering them in the document is not mistaken for a code change.
 */
export function useCaseComparable(
  useCase: DesignedUseCase,
): DesignedUseCaseComparable {
  const project = (fields: readonly { name: string; type: string }[]) =>
    fields.map((field) => ({ name: field.name, type: field.type }));
  return {
    name: useCase.name,
    type: useCase.type,
    applicationServiceId: useCase.applicationServiceId,
    actorIds: [...useCase.actorIds].sort(),
    input: project(useCase.input.fields),
    output: project(useCase.output.fields),
  };
}

const USE_CASE_LABELS = {
  name: 'name',
  type: 'type',
  applicationServiceId: 'owning application service',
  actorIds: 'actor references',
  input: 'input structure',
  output: 'output structure',
} as const;

export const useCaseState = (useCase: DesignedUseCase): CodebaseState =>
  stateOf(useCase, useCaseComparable(useCase));

/** What changed against the baseline, empty unless the state is Modified. */
export const useCaseBaselineDiff = (
  useCase: DesignedUseCase,
): BaselineFieldDiff[] =>
  diffOf(useCase, useCaseComparable(useCase), USE_CASE_LABELS, (key, value) => {
    if (key === 'input' || key === 'output') {
      return structure(value as { name: string; type: string }[]);
    }
    if (key === 'actorIds') return (value as string[]).join(', ') || 'none';
    return value === null ? 'none' : String(value);
  });

/* -------------------------------------------------------- other structure */

export const actorComparable = (
  actor: DesignedActor,
): DesignedActorComparable => ({ name: actor.name, kind: actor.kind });

export const actorState = (actor: DesignedActor): CodebaseState =>
  stateOf(actor, actorComparable(actor));

export const boundedContextComparable = (
  context: DesignedBoundedContext,
): DesignedBoundedContextComparable => ({ name: context.name });

export const boundedContextState = (
  context: DesignedBoundedContext,
): CodebaseState => stateOf(context, boundedContextComparable(context));

export const domainModuleComparable = (
  module: DesignedDomainModule,
): DesignedDomainModuleComparable => ({
  name: module.name,
  boundedContextId: module.boundedContextId,
});

export const domainModuleState = (
  module: DesignedDomainModule,
): CodebaseState => stateOf(module, domainModuleComparable(module));

export const buildingBlockComparable = (
  block: DesignedBuildingBlock,
): DesignedBuildingBlockComparable => ({
  name: block.name,
  type: block.type,
  boundedContextId: block.boundedContextId,
  domainModuleId: block.domainModuleId,
  properties: block.properties.map((property) => ({
    name: property.name,
    type: property.type,
  })),
});

export const buildingBlockState = (
  block: DesignedBuildingBlock,
): CodebaseState => stateOf(block, buildingBlockComparable(block));

export const behaviourComparable = (
  behaviour: DesignedBehaviour,
): DesignedBehaviourComparable => ({
  name: behaviour.name,
  type: behaviour.type,
  buildingBlockId: behaviour.buildingBlockId,
});

export const behaviourState = (behaviour: DesignedBehaviour): CodebaseState =>
  stateOf(behaviour, behaviourComparable(behaviour));

/**
 * Snapshot an element against a scan, so that from now on it compares as
 * Existing. Used when a scan imports an element and when a baseline refresh is
 * accepted.
 */
export function snapshotUseCase(
  useCase: DesignedUseCase,
  scanId: string,
): DesignedUseCase {
  return {
    ...useCase,
    baseline: { scanId, comparable: useCaseComparable(useCase) },
  };
}
