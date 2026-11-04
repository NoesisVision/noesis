import { z } from 'zod';
import {
  ActorId,
  ArtifactName,
  BehaviorId,
  BuildingBlockId,
  DeployableUnitId,
  DeploymentContainerId,
  ElementName,
  LayerId,
  LibraryId,
  ManualProcessId,
  ModuleId,
  RuleId,
  ScenarioId,
} from '#backend/app/element-id';
import { SystemModelId } from './system-model-id';

/*
 * What every element and every relation of the model is built from. The
 * elements follow, each kind with the vocabulary it alone uses, then what
 * types a slot, then the relations, then the model that holds them all.
 */

export const SourceLocation = z
  .strictObject({
    path: z.string(),
    line: z.int().min(1).nullable().default(null),
  })
  .describe(
    'Where an element was found: a file by its path from the repository root, and the line in it when known.',
  );
export type SourceLocation = z.infer<typeof SourceLocation>;

/**
 * What every element of the model carries: its id, its name, an optional
 * description and where it was found. Each kind of element narrows the id
 * and adds what is its own.
 */
const ScannedElement = z.strictObject({
  id: z.string(),
  name: ElementName,
  description: z.string().nullable().default(null),
  source: SourceLocation,
});

/**
 * What every relation of the model carries: its kind and its two ends. Each
 * kind of relation fixes the kind, narrows the ends and adds its edge data. The relations between elements are one list
 * for all of them: an element carries only what is its own, and a relation
 * carries what the diagram puts on its edge — a name, a cardinality, an
 * order. Containment is in the id too (`building_block|sales.orders.Order`
 * is in `module|sales.orders`) and is written as a relation as well, so the
 * list is complete.
 */
const ScannedRelation = z.strictObject({
  kind: z.string(),
  from: z.string(),
  to: z.string(),
});

/* The elements, in the order the model lists them. */

export const ScannedDomainModule = ScannedElement.extend({
  id: ModuleId,
}).describe(
  "A module: a package or namespace of the code that groups building blocks and other modules; 'contains' relations name what is in it.",
);
export type ScannedDomainModule = z.infer<typeof ScannedDomainModule>;

export const BuildingBlockKind = z
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
export type BuildingBlockKind = z.infer<typeof BuildingBlockKind>;

export const ScannedBuildingBlock = ScannedElement.extend({
  id: BuildingBlockId,
  type: BuildingBlockKind,
}).describe(
  'A building block: a class, interface, struct or enum of the code that an annotation names as one of the kinds; its state, collaborators and the behaviors it exposes are relations.',
);
export type ScannedBuildingBlock = z.infer<typeof ScannedBuildingBlock>;

export const ScannedBehavior = ScannedElement.extend({
  id: BehaviorId,
}).describe(
  "A behavior: a public method of a building block, named by the block's id path and its own name; its inputs, output, the behaviors it invokes and the rules it governs are relations.",
);
export type ScannedBehavior = z.infer<typeof ScannedBehavior>;

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

export const ScannedRule = ScannedElement.extend({
  id: RuleId,
  kind: RuleKind,
}).describe(
  'A rule: a `Rule:` of a feature file, its kind the tag on it; behaviors govern it, scenarios illustrate it.',
);
export type ScannedRule = z.infer<typeof ScannedRule>;

export const ScenarioStepKind = z
  .enum(['given', 'when', 'then'])
  .describe(
    "Which part of a scenario a step is: 'given' sets the starting state, 'when' is the action, 'then' the outcome.",
  );
export type ScenarioStepKind = z.infer<typeof ScenarioStepKind>;

export const ScenarioStep = z
  .strictObject({
    kind: ScenarioStepKind,
    text: z.string(),
  })
  .describe('One step of a scenario: its kind and what it says.');
export type ScenarioStep = z.infer<typeof ScenarioStep>;

export const ScenarioSteps = z
  .array(ScenarioStep)
  .min(1)
  .describe(
    'The steps in reading order; each kind may repeat or be left out, but there is at least one step. Consecutive steps of one kind read as "And".',
  );

export const ScannedScenario = ScannedElement.extend({
  id: ScenarioId,
  steps: ScenarioSteps,
}).describe(
  "A scenario: a `Scenario:` of a feature file under the `Rule:` it illustrates, its steps as written there, the feature's and the rule's `Background:` first.",
);
export type ScannedScenario = z.infer<typeof ScannedScenario>;

export const ScannedActor = ScannedElement.extend({ id: ActorId }).describe(
  "A person or role outside the code who drives the system: named by an actor annotation on a behavior, found where it is first named; 'performs' relations name the manual processes they carry out.",
);
export type ScannedActor = z.infer<typeof ScannedActor>;

export const ScannedManualProcess = ScannedElement.extend({
  id: ManualProcessId,
}).describe(
  "Work an actor performs that is not automated, calling behaviors in order through 'invokes' relations; found in the test that encodes it.",
);

export const ScannedDeployableUnit = ScannedElement.extend({
  id: DeployableUnitId,
  name: ArtifactName,
}).describe(
  "Something built and shipped as one piece: an executable artifact of the build (a service, a runnable JAR, an executable assembly), named as the build names it; its 'ships' relations name the modules in it.",
);
export type ScannedDeployableUnit = z.infer<typeof ScannedDeployableUnit>;

export const ScannedLibrary = ScannedElement.extend({
  id: LibraryId,
  name: ArtifactName,
}).describe(
  "A reusable package of building blocks: an artifact of the build that is no executable, named as the build names it; its 'provides' relations name the blocks in it.",
);
export type ScannedLibrary = z.infer<typeof ScannedLibrary>;

export const ScannedLayer = ScannedElement.extend({ id: LayerId }).describe(
  "A horizontal slice of the code (domain, application, infrastructure, …): named by a layer annotation on a package or namespace, found on the first package by path that names it; its 'places' relations name the blocks in it.",
);
export type ScannedLayer = z.infer<typeof ScannedLayer>;

export const ScannedDeploymentContainer = ScannedElement.extend({
  id: DeploymentContainerId,
}).describe(
  "Where deployable units run: a cluster, a server, a serverless platform; 'hosts' relations name the units on it; found in the infrastructure-as-code file that declares it.",
);

/* What types a slot — a piece of state, an input, an output — and how many values it holds. */

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

export const TypeId = z
  .union([BuildingBlockId, PrimitiveId])
  .describe(
    "What a slot (a piece of state, an input, an output) is typed by: a building block's id or a primitive's, never a wrapper. A collection is said by the relation's cardinality, never by the type.",
  );
export type TypeId = z.infer<typeof TypeId>;

export const Cardinality = z
  .enum(['0..1', '1', '0..*', '1..*'])
  .describe(
    "How many values the slot holds: '1' exactly one, '0..1' one or none, '0..*' any number, '1..*' at least one.",
  );
export type Cardinality = z.infer<typeof Cardinality>;

/* The relations, one schema a kind, then their union. */

export const ContainsRelation = ScannedRelation.extend({
  kind: z.literal('contains'),
  from: ModuleId,
  to: z.union([ModuleId, BuildingBlockId]),
}).describe(
  "A module holds a module or a building block, `to`'s id path being `from`'s path and its own name.",
);

export const ShipsRelation = ScannedRelation.extend({
  kind: z.literal('ships'),
  from: DeployableUnitId,
  to: ModuleId,
}).describe('A deployable unit ships a module: the module is built into it.');

export const ProvidesRelation = ScannedRelation.extend({
  kind: z.literal('provides'),
  from: LibraryId,
  to: BuildingBlockId,
}).describe(
  'A library provides a building block: the block is packaged in it.',
);

export const PlacesRelation = ScannedRelation.extend({
  kind: z.literal('places'),
  from: LayerId,
  to: BuildingBlockId,
}).describe(
  'A layer places a building block: the block is in that slice of the code.',
);

export const ExtendsRelation = ScannedRelation.extend({
  kind: z.literal('extends'),
  from: BuildingBlockId,
  to: BuildingBlockId,
}).describe('A building block extends or implements another.');

export const HasStateRelation = ScannedRelation.extend({
  kind: z.literal('has_state'),
  from: BuildingBlockId,
  to: TypeId,
  name: ElementName,
  cardinality: Cardinality,
}).describe(
  "A building block's piece of state: a field or property named `name`, typed by `to` (a primitive, or a block whose kind is a value of the domain), holding `cardinality` values.",
);

export const HasCollaboratorRelation = ScannedRelation.extend({
  kind: z.literal('has_collaborator'),
  from: BuildingBlockId,
  to: BuildingBlockId,
  name: ElementName,
}).describe(
  'A building block works with another it holds, named `name`: a repository, a service, an integration or an adapter, by the kind of `to`. A value of the domain it holds is its state (`has_state`) instead.',
);

export const ExposesRelation = ScannedRelation.extend({
  kind: z.literal('exposes'),
  from: BuildingBlockId,
  to: BehaviorId,
}).describe(
  "A building block exposes a behavior; the behavior's id path is the block's path and its own name.",
);

export const HasInputRelation = ScannedRelation.extend({
  kind: z.literal('has_input'),
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

export const HasOutputRelation = ScannedRelation.extend({
  kind: z.literal('has_output'),
  from: BehaviorId,
  to: TypeId,
  cardinality: Cardinality,
}).describe(
  'What a behavior gives back: typed by `to`, holding `cardinality` values; a behavior has at most one.',
);

export const InvokesRelation = ScannedRelation.extend({
  kind: z.literal('invokes'),
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

export const GovernsRelation = ScannedRelation.extend({
  kind: z.literal('governs'),
  from: BehaviorId,
  to: RuleId,
}).describe(
  "A behavior enforces or follows a rule: the behavior the `When` steps of the rule's scenarios invoke.",
);

export const IllustratesRelation = ScannedRelation.extend({
  kind: z.literal('illustrates'),
  from: ScenarioId,
  to: RuleId,
}).describe(
  "A scenario is an example of a rule; the scenario's id path is the rule's path and its own name.",
);

export const PerformsRelation = ScannedRelation.extend({
  kind: z.literal('performs'),
  from: ActorId,
  to: ManualProcessId,
}).describe('An actor carries out a manual process.');

export const HostsRelation = ScannedRelation.extend({
  kind: z.literal('hosts'),
  from: DeploymentContainerId,
  to: DeployableUnitId,
}).describe('A deployment container runs a deployable unit.');

const relationSchema = z.discriminatedUnion('kind', [
  ContainsRelation,
  ShipsRelation,
  ProvidesRelation,
  PlacesRelation,
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
  HostsRelation,
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
    commit: z
      .string()
      .regex(/^[0-9a-f]{4,40}$/)
      .nullable()
      .default(null)
      .describe(
        'Short hash of the commit scanned; null when the repository has none.',
      ),
    modules: z.array(ScannedDomainModule).default([]),
    buildingBlocks: z.array(ScannedBuildingBlock).default([]),
    behaviors: z.array(ScannedBehavior).default([]),
    rules: z.array(ScannedRule).default([]),
    scenarios: z.array(ScannedScenario).default([]),
    actors: z.array(ScannedActor).default([]),
    manualProcesses: z.array(ScannedManualProcess).default([]),
    deployableUnits: z.array(ScannedDeployableUnit).default([]),
    libraries: z.array(ScannedLibrary).default([]),
    layers: z.array(ScannedLayer).default([]),
    deploymentContainers: z.array(ScannedDeploymentContainer).default([]),
    relations: z.array(relationSchema).default([]),
  })
  .describe(
    'The implemented model as one scan found it: graph/system-models/YYYY-MM-DD_HH-MM_<commit>.json, the scan minute in UTC. Every scan is kept, except that one in the same minute on the same commit replaces the one before; the highest id is the newest.',
  );
export type SystemModel = z.infer<typeof SystemModel>;
