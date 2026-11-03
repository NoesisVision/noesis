import { z } from 'zod';
import {
  ActorId,
  ArtifactName,
  BehaviorId,
  BuildingBlockId,
  DeployableUnitId,
  ElementName,
  LibraryId,
  ManualProcessId,
  ModuleId,
  RuleId,
  ScenarioId,
} from '#backend/app/element-id';
import { SystemModelId } from './system-model-id';

export const BuildingBlockType = z
  .enum([
    'aggregate',
    'entity',
    'value_object',
    'domain_service',
    'application_service',
    'repository',
    'factory',
    'external_integration',
    'in_adapter',
    'out_adapter',
    'technical_service',
    'event',
    'command',
    'query',
  ])
  .describe(
    "What a building block is. The domain's values: 'aggregate', 'entity', 'value_object', and the messages 'event', 'command', 'query'. The parts that do the work: 'domain_service', 'application_service', 'repository', 'factory', 'external_integration', 'in_adapter' (drives the system from outside), 'out_adapter' (the system drives something outside through it), 'technical_service'.",
  );
export type BuildingBlockType = z.infer<typeof BuildingBlockType>;

/**
 * The kinds a block holds as its state: the domain's values. A block of any
 * other kind is one a block works with, held as a collaborator. The kind
 * decides alone: a domain service held as a strategy is a collaborator, an
 * aggregate a repository caches is state.
 */
const STATE_TYPES: ReadonlySet<BuildingBlockType> = new Set([
  'aggregate',
  'entity',
  'value_object',
  'event',
  'command',
  'query',
]);

/** Whether a block of this kind is held as a collaborator rather than as state. */
export const isCollaboratorType = (type: BuildingBlockType): boolean =>
  !STATE_TYPES.has(type);

export const RuleKind = z
  .enum([
    'validation',
    'state_change',
    'post',
    'computation',
    'coordination',
    'configuration',
  ])
  .describe(
    "What a rule does: 'validation' accepts or rejects input before anything changes; 'state_change' says how state moves from one value to the next; 'post' must hold, or happen, after a behavior completes; 'computation' derives a value from others; 'coordination' orders or ties together work across behaviors or building blocks; 'configuration' is set by a setting rather than fixed in code.",
  );
export type RuleKind = z.infer<typeof RuleKind>;

const PRIMITIVE_KIND = 'primitive';
const PRIMITIVES = [
  'string',
  'integer',
  'decimal',
  'boolean',
  'date',
  'datetime',
  'duration',
  'uuid',
];
export const PrimitiveId = z
  .string()
  .regex(
    new RegExp(`^${PRIMITIVE_KIND}\\|(?:${PRIMITIVES.join('|')})$`),
    'Invalid PrimitiveId',
  )
  .describe(
    `A built-in building block's id: '${PRIMITIVE_KIND}|', then one of ${PRIMITIVES.join(', ')}, e.g. '${PRIMITIVE_KIND}|uuid'.`,
  )
  .brand<'PrimitiveId'>();
export type PrimitiveId = z.infer<typeof PrimitiveId>;

/** What a slot (a piece of state, an input, an output) is typed by: a building block or a primitive, never a wrapper. */
export const TypeId = z
  .union([BuildingBlockId, PrimitiveId])
  .describe(
    "The type of a slot: a building block's id or a primitive's. A collection is said by the relation's cardinality, never by the type.",
  );
export type TypeId = z.infer<typeof TypeId>;

/** How many values a slot holds: a collection and an optional value are told apart by it. */
export const Cardinality = z
  .enum(['0..1', '1', '0..*', '1..*'])
  .describe(
    "How many values the slot holds: '1' exactly one, '0..1' one or none, '0..*' any number, '1..*' at least one.",
  );
export type Cardinality = z.infer<typeof Cardinality>;

export const SourceLocation = z.strictObject({
  path: z.string(),
  line: z.int().min(1).nullable().default(null),
});
export type SourceLocation = z.infer<typeof SourceLocation>;

/** Which part of a scenario a step is: the starting state, the action, the outcome. */
export const ScenarioStepKind = z
  .enum(['given', 'when', 'then'])
  .describe(
    "'given' sets the starting state, 'when' is the action, 'then' the outcome.",
  );
export type ScenarioStepKind = z.infer<typeof ScenarioStepKind>;

/** One step of a scenario: its kind and what it says. */
export const ScenarioStep = z.strictObject({
  kind: ScenarioStepKind,
  text: z.string(),
});
export type ScenarioStep = z.infer<typeof ScenarioStep>;

/**
 * A scenario's steps in the order they are read. Any kind may come any
 * number of times — none, too — but there is at least one step.
 */
export const ScenarioSteps = z
  .array(ScenarioStep)
  .min(1)
  .describe(
    'The steps in reading order; each kind may repeat or be left out, but there is at least one step. Consecutive steps of one kind read as "And".',
  );

/**
 * A scenario: a `Scenario:` of a feature file under the `Rule:` it
 * illustrates, its steps as written there, the feature's and the rule's
 * `Background:` first.
 */
export const ScannedScenario = z.strictObject({
  id: ScenarioId,
  name: ElementName,
  description: z.string().nullable().default(null),
  steps: ScenarioSteps,
  source: SourceLocation,
});
export type ScannedScenario = z.infer<typeof ScannedScenario>;

/** A rule: a `Rule:` of a feature file, its kind the tag on it; behaviors govern it. */
export const ScannedRule = z.strictObject({
  id: RuleId,
  name: ElementName,
  kind: RuleKind,
  description: z.string().nullable().default(null),
  source: SourceLocation,
});
export type ScannedRule = z.infer<typeof ScannedRule>;

export const ScannedDomainModule = z.strictObject({
  id: ModuleId,
  name: ElementName,
  description: z.string().nullable().default(null),
  source: SourceLocation,
});
export type ScannedDomainModule = z.infer<typeof ScannedDomainModule>;

export const ScannedBuildingBlock = z.strictObject({
  id: BuildingBlockId,
  name: ElementName,
  type: BuildingBlockType,
  description: z.string().nullable().default(null),
  source: SourceLocation,
});
export type ScannedBuildingBlock = z.infer<typeof ScannedBuildingBlock>;

export const ScannedBehavior = z.strictObject({
  id: BehaviorId,
  name: ElementName,
  description: z.string().nullable().default(null),
  source: SourceLocation,
});
export type ScannedBehavior = z.infer<typeof ScannedBehavior>;

/** A person or role outside the code: named by an actor annotation on a behavior, found where it is first named. */
export const ScannedActor = z.strictObject({
  id: ActorId,
  name: ElementName,
  description: z.string().nullable().default(null),
  source: SourceLocation,
});
export type ScannedActor = z.infer<typeof ScannedActor>;

/**
 * Work an actor performs that is not automated, calling behaviors in order.
 * No scan finds one: a design document authors it.
 */
export const ScannedManualProcess = z.strictObject({
  id: ManualProcessId,
  name: ElementName,
  description: z.string().nullable().default(null),
  source: SourceLocation.nullable().default(null),
});
export type ScannedManualProcess = z.infer<typeof ScannedManualProcess>;

/**
 * Something built and shipped as one piece: an executable artifact of the
 * build (a service, a runnable JAR, an executable assembly), named as the
 * build names it; it contains modules.
 */
export const ScannedDeployableUnit = z.strictObject({
  id: DeployableUnitId,
  name: ArtifactName,
  description: z.string().nullable().default(null),
  source: SourceLocation.nullable().default(null),
});
export type ScannedDeployableUnit = z.infer<typeof ScannedDeployableUnit>;

/**
 * A reusable package of building blocks: an artifact of the build that is no
 * executable, named as the build names it; it contains building blocks.
 */
export const ScannedLibrary = z.strictObject({
  id: LibraryId,
  name: ArtifactName,
  description: z.string().nullable().default(null),
  source: SourceLocation.nullable().default(null),
});
export type ScannedLibrary = z.infer<typeof ScannedLibrary>;

/*
 * The relations between elements, one list for all of them: an element
 * carries only what is its own, and a relation carries what the diagram
 * puts on its edge — a name, a cardinality, an order. Containment is in
 * the id too (`building_block|sales.orders.Order` is in `module|sales.orders`)
 * and is written as a relation as well, so the list is complete.
 */

const relation = <Kind extends string, Shape extends z.ZodRawShape>(
  kind: Kind,
  shape: Shape,
) => z.strictObject({ kind: z.literal(kind), ...shape });

export const RelationKind = z.enum([
  'contains',
  'extends',
  'has_state',
  'has_collaborator',
  'exposes',
  'has_input',
  'has_output',
  'invokes',
  'governs',
  'illustrates',
  'performs',
]);
export type RelationKind = z.infer<typeof RelationKind>;

export const ContainsRelation = relation('contains', {
  from: z.union([ModuleId, DeployableUnitId, LibraryId]),
  to: z.union([ModuleId, BuildingBlockId]),
}).describe(
  "A module holds a module or a building block, `to`'s id path being `from`'s path and its own name; a deployable unit holds a module; a library holds a building block.",
);
export const ExtendsRelation = relation('extends', {
  from: BuildingBlockId,
  to: BuildingBlockId,
}).describe('A building block extends or implements another.');
export const HasStateRelation = relation('has_state', {
  from: BuildingBlockId,
  to: TypeId,
  name: ElementName,
  cardinality: Cardinality,
}).describe(
  "A building block's piece of state: a field or property named `name`, typed by `to` (a primitive, or a block whose kind is a value of the domain), holding `cardinality` values.",
);
export const HasCollaboratorRelation = relation('has_collaborator', {
  from: BuildingBlockId,
  to: BuildingBlockId,
  name: ElementName,
}).describe(
  'A building block works with another it holds, named `name`: a repository, a service, an integration or an adapter, by the kind of `to`. A value of the domain it holds is its state (`has_state`) instead.',
);
export const ExposesRelation = relation('exposes', {
  from: BuildingBlockId,
  to: BehaviorId,
}).describe(
  "A building block exposes a behavior; the behavior's id path is the block's path and its own name.",
);
export const HasInputRelation = relation('has_input', {
  from: BehaviorId,
  to: TypeId,
  name: ElementName,
  cardinality: Cardinality,
  position: z
    .int()
    .min(1)
    .describe(
      'Where the parameter stands in the signature, counting from 1; the parameters of a behavior read in this order.',
    ),
}).describe(
  'A parameter of a behavior: named `name`, typed by `to`, holding `cardinality` values, the `position`th of its signature.',
);
export const HasOutputRelation = relation('has_output', {
  from: BehaviorId,
  to: TypeId,
  cardinality: Cardinality,
}).describe(
  'What a behavior gives back: typed by `to`, holding `cardinality` values; a behavior has at most one.',
);
export const InvokesRelation = relation('invokes', {
  from: z.union([BehaviorId, ManualProcessId]),
  to: BehaviorId,
  order: z
    .int()
    .min(1)
    .describe(
      'The position of the call within the calling behavior or manual process, counting from 1; a behavior called twice keeps its first.',
    ),
}).describe(
  'A behavior or a manual process calls a behavior, as its `order`th step; a behavior never calls itself.',
);
export const GovernsRelation = relation('governs', {
  from: BehaviorId,
  to: RuleId,
}).describe(
  "A behavior enforces or follows a rule: the behavior the `When` steps of the rule's scenarios invoke.",
);
export const IllustratesRelation = relation('illustrates', {
  from: ScenarioId,
  to: RuleId,
}).describe(
  "A scenario is an example of a rule; the scenario's id path is the rule's path and its own name.",
);

export const PerformsRelation = relation('performs', {
  from: ActorId,
  to: ManualProcessId,
}).describe('An actor carries out a manual process.');

const relationSchema = z.discriminatedUnion('kind', [
  ContainsRelation,
  ExtendsRelation,
  HasStateRelation,
  HasCollaboratorRelation,
  ExposesRelation,
  HasInputRelation,
  HasOutputRelation,
  InvokesRelation,
  GovernsRelation,
  IllustratesRelation,
  PerformsRelation,
]);
export type Relation = z.infer<typeof relationSchema>;

/** What makes a relation one of a kind: its ends, or, for a named slot, its holder and name; a designed slot's `to` is a field. */
export interface RelationKey {
  readonly kind: string;
  readonly from: string;
  readonly to?: unknown;
  readonly name?: string;
}

/** Relation kinds a holder may have several of to one type: unique by name, not by `to`. */
const NAMED_SLOTS: ReadonlySet<string> = new Set([
  'has_state',
  'has_collaborator',
  'has_input',
]);

export const Relation = Object.assign(relationSchema, {
  /** The key a relation is unique by: `(kind, from, to)`, or `(kind, from, name)` for a named slot. */
  keyOf: (relation: RelationKey): string =>
    NAMED_SLOTS.has(relation.kind)
      ? `${relation.kind}|${relation.from}|#${relation.name}`
      : `${relation.kind}|${relation.from}|${String(relation.to)}`,
  /** Sorted by kind, from, position, to, then name or order, so two builds give one file and a signature reads in its order. */
  compare: (a: Relation, b: Relation): number =>
    byCodeUnit(a.kind, b.kind) ||
    byCodeUnit(a.from, b.from) ||
    positionOf(a) - positionOf(b) ||
    byCodeUnit(a.to, b.to) ||
    byCodeUnit(nameOf(a), nameOf(b)) ||
    orderOf(a) - orderOf(b),
});

const nameOf = (relation: Relation) =>
  'name' in relation ? relation.name : '';
const orderOf = (relation: Relation) =>
  'order' in relation ? relation.order : 0;
const positionOf = (relation: Relation) =>
  'position' in relation ? relation.position : 0;
const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export const SystemModel = z
  .strictObject({
    id: SystemModelId,
    name: z.string(),
    scanned_at: z.string(),
    /** Short hash of the commit scanned; null when the repository has none. */
    commit: z
      .string()
      .regex(/^[0-9a-f]{4,40}$/)
      .nullable()
      .default(null),
    modules: z.array(ScannedDomainModule).default([]),
    buildingBlocks: z.array(ScannedBuildingBlock).default([]),
    behaviors: z.array(ScannedBehavior).default([]),
    rules: z.array(ScannedRule).default([]),
    scenarios: z.array(ScannedScenario).default([]),
    actors: z.array(ScannedActor).default([]),
    manualProcesses: z.array(ScannedManualProcess).default([]),
    deployableUnits: z.array(ScannedDeployableUnit).default([]),
    libraries: z.array(ScannedLibrary).default([]),
    relations: z.array(relationSchema).default([]),
  })
  .describe(
    'The implemented model as one scan found it: graph/system-models/YYYY-MM-DD_HH-MM_<commit>.json, the scan minute in UTC. Every scan is kept, except that one in the same minute on the same commit replaces the one before; the highest id is the newest.',
  );
export type SystemModel = z.infer<typeof SystemModel>;
