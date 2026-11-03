import { z } from 'zod';
import {
  BehaviorId,
  BuildingBlockId,
  ElementName,
  ModuleId,
} from '#backend/app/element-id';
import { SystemModelId } from './system-model-id';

export const BuildingBlockType = z.enum([
  'aggregate',
  'entity',
  'value_object',
  'domain_service',
  'application_service',
  'repository',
  'factory',
  'external_integration',
]);
export type BuildingBlockType = z.infer<typeof BuildingBlockType>;

export const RuleCategory = z
  .enum(['Business', 'Quality', 'Constraint'])
  .describe(
    "What a rule is: 'Business', a truth of the domain; 'Quality', a measurable quality the system must have (ISO/IEC 25010); 'Constraint', a limit imposed on the solution from outside the domain.",
  );
export type RuleCategory = z.infer<typeof RuleCategory>;

const BUSINESS_RULE_TYPES = [
  'Consistency',
  'Structure',
  'Computation',
  'State change',
] as const;
const QUALITY_RULE_TYPES = [
  'Performance',
  'Security',
  'Reliability',
  'Usability',
  'Compatibility',
  'Maintainability',
  'Portability',
] as const;
const CONSTRAINT_RULE_TYPES = [
  'Technology',
  'Regulation',
  'Interface',
  'Organisation',
] as const;

export const RuleType = z
  .enum([
    ...BUSINESS_RULE_TYPES,
    ...QUALITY_RULE_TYPES,
    ...CONSTRAINT_RULE_TYPES,
  ])
  .describe(
    `The kind of rule within its category. Business: ${BUSINESS_RULE_TYPES.join(', ')}. Quality: ${QUALITY_RULE_TYPES.join(', ')}. Constraint: ${CONSTRAINT_RULE_TYPES.join(', ')}.`,
  );
export type RuleType = z.infer<typeof RuleType>;

/** The rule types each category allows. */
export const RULE_TYPES_OF: Record<RuleCategory, readonly RuleType[]> = {
  Business: BUSINESS_RULE_TYPES,
  Quality: QUALITY_RULE_TYPES,
  Constraint: CONSTRAINT_RULE_TYPES,
};

export const BehaviorType = z.enum(['Command', 'Event', 'Query']);
export type BehaviorType = z.infer<typeof BehaviorType>;

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
export const TypeRef = z
  .union([BuildingBlockId, PrimitiveId])
  .describe(
    "The type of a slot: a building block's id or a primitive's. A collection is said by the relation's cardinality, never by the type.",
  );
export type TypeRef = z.infer<typeof TypeRef>;

/** How many values a slot holds: a collection and an optional value are told apart by it. */
export const Cardinality = z
  .enum(['0..1', '1', '0..*', '1..*'])
  .describe(
    "How many values the slot holds: '1' exactly one, '0..1' one or none, '0..*' any number, '1..*' at least one.",
  );
export type Cardinality = z.infer<typeof Cardinality>;

export const Visibility = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('private') }),
  z.strictObject({ kind: z.literal('public'), actors: z.array(z.string()) }),
]);
export type Visibility = z.infer<typeof Visibility>;

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
 * A scenario as a scan found it. Code carries a scenario's title and little
 * else, so the description and the steps may be missing; a designed scenario
 * (`DesignedScenario`) has both.
 */
export const ScannedScenario = z.strictObject({
  name: ElementName,
  description: z.string().nullable().default(null),
  steps: z.array(ScenarioStep).default([]),
});
export type ScannedScenario = z.infer<typeof ScannedScenario>;

export const ScannedRule = z.strictObject({
  name: ElementName,
  category: RuleCategory.default('Business'),
  ruleType: RuleType,
  description: z.string().nullable().default(null),
  scenarios: z.array(ScannedScenario).default([]),
});
export type ScannedRule = z.infer<typeof ScannedRule>;

export const ScannedDomainModule = z.strictObject({
  id: ModuleId,
  name: ElementName,
  description: z.string().nullable().default(null),
  rules: z.array(ScannedRule).default([]),
  source: SourceLocation,
});
export type ScannedDomainModule = z.infer<typeof ScannedDomainModule>;

export const ScannedBuildingBlock = z.strictObject({
  id: BuildingBlockId,
  name: ElementName,
  type: BuildingBlockType,
  description: z.string().nullable().default(null),
  rules: z.array(ScannedRule).default([]),
  scenarios: z.array(ScannedScenario).default([]),
  source: SourceLocation,
});
export type ScannedBuildingBlock = z.infer<typeof ScannedBuildingBlock>;

export const ScannedBehavior = z.strictObject({
  id: BehaviorId,
  name: ElementName,
  type: BehaviorType,
  description: z.string().nullable().default(null),
  visibility: Visibility,
  rules: z.array(ScannedRule).default([]),
  scenarios: z.array(ScannedScenario).default([]),
  source: SourceLocation,
});
export type ScannedBehavior = z.infer<typeof ScannedBehavior>;

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
  'exposes',
  'has_input',
  'has_output',
  'invokes',
]);
export type RelationKind = z.infer<typeof RelationKind>;

export const ContainsRelation = relation('contains', {
  from: ModuleId,
  to: z.union([ModuleId, BuildingBlockId]),
}).describe(
  "A module holds a module or a building block; `to`'s id path is `from`'s path and its own name.",
);
export const ExtendsRelation = relation('extends', {
  from: BuildingBlockId,
  to: BuildingBlockId,
}).describe('A building block extends or implements another.');
export const HasStateRelation = relation('has_state', {
  from: BuildingBlockId,
  to: TypeRef,
  name: ElementName,
  cardinality: Cardinality,
}).describe(
  "A building block's piece of state: a field or property named `name`, typed by `to`, holding `cardinality` values.",
);
export const ExposesRelation = relation('exposes', {
  from: BuildingBlockId,
  to: BehaviorId,
}).describe(
  "A building block exposes a behavior; the behavior's id path is the block's path and its own name.",
);
export const HasInputRelation = relation('has_input', {
  from: BehaviorId,
  to: TypeRef,
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
  to: TypeRef,
  cardinality: Cardinality,
}).describe(
  'What a behavior gives back: typed by `to`, holding `cardinality` values; a behavior has at most one.',
);
export const InvokesRelation = relation('invokes', {
  from: BehaviorId,
  to: BehaviorId,
  order: z
    .int()
    .min(1)
    .describe(
      'The position of the call within the calling behavior, counting from 1; a behavior called twice keeps its first.',
    ),
}).describe('A behavior calls another, as the `order`th step; never itself.');

const relationSchema = z.discriminatedUnion('kind', [
  ContainsRelation,
  ExtendsRelation,
  HasStateRelation,
  ExposesRelation,
  HasInputRelation,
  HasOutputRelation,
  InvokesRelation,
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
const NAMED_SLOTS: ReadonlySet<string> = new Set(['has_state', 'has_input']);

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
    relations: z.array(relationSchema).default([]),
  })
  .describe(
    'The implemented model as one scan found it: graph/system-models/YYYY-MM-DD_HH-MM_<commit>.json, the scan minute in UTC. Every scan is kept, except that one in the same minute on the same commit replaces the one before; the highest id is the newest.',
  );
export type SystemModel = z.infer<typeof SystemModel>;
