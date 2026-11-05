import { z } from 'zod';
import {
  BehaviorId,
  BuildingBlockId,
  ElementName,
  ModuleId,
} from '#backend/app/element-id';
import { SystemModelId } from './system-model-id';

/*
 * What every element and every relation of the model is built from. The
 * parts elements share follow, then the elements, each kind with the
 * vocabulary it alone uses, then what types a slot, then the relations,
 * then the model that holds them all.
 */

export const SourceLocation = z
  .strictObject({
    path: z.string(),
    startLine: z
      .int()
      .min(1)
      .nullable()
      .default(null)
      .describe(
        'The first line of the element, counting from 1; null when unknown.',
      ),
    endLine: z
      .int()
      .min(1)
      .nullable()
      .default(null)
      .describe(
        'The last line of the element, counting from 1; null when unknown.',
      ),
  })
  .describe(
    'Where an element was found: a file by its path from the repository root, and the lines it spans in it, each when known.',
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
 * kind of relation fixes the kind, narrows the ends and adds its edge data.
 * The relations between elements are one list for all of them: an element
 * carries only what is its own, and a relation carries what the diagram
 * puts on its edge — a name, a cardinality, an order. Containment is in the
 * id too (`building_block|sales.orders.Order` is in `module|sales.orders`)
 * and is written as a relation as well, so the list is complete.
 */
const ScannedRelation = z.strictObject({
  kind: z.string(),
  from: z.string(),
  to: z.string(),
});

/** What a behavior's output is named: the code gives a return value no name of its own. */
export const OUTPUT_NAME = 'result';

/* The parts elements share: rules and the scenarios that illustrate them. */

export const RuleCategory = z
  .enum(['Business', 'Quality', 'Constraint'])
  .describe(
    "What a rule is: 'Business', a truth of the domain; 'Quality', a measurable quality the system must have (ISO/IEC 25010); 'Constraint', a limit imposed on the solution from outside the domain.",
  );
export type RuleCategory = z.infer<typeof RuleCategory>;

export const BusinessRuleType = z.enum([
  'Consistency',
  'Structure',
  'Computation',
  'State change',
]);
export const QualityRuleType = z.enum([
  'Performance',
  'Security',
  'Reliability',
  'Usability',
  'Compatibility',
  'Maintainability',
  'Portability',
]);
export const ConstraintRuleType = z.enum([
  'Technology',
  'Regulation',
  'Interface',
  'Organisation',
]);

export const RuleType = z
  .enum([
    ...BusinessRuleType.options,
    ...QualityRuleType.options,
    ...ConstraintRuleType.options,
  ])
  .describe(
    `The kind of rule within its category. Business: ${BusinessRuleType.options.join(', ')}. Quality: ${QualityRuleType.options.join(', ')}. Constraint: ${ConstraintRuleType.options.join(', ')}.`,
  );
export type RuleType = z.infer<typeof RuleType>;

/** The rule types each category allows. */
export const RULE_TYPES_OF: Record<RuleCategory, readonly RuleType[]> = {
  Business: BusinessRuleType.options,
  Quality: QualityRuleType.options,
  Constraint: ConstraintRuleType.options,
};

export const ScenarioStepKind = z
  .enum(['given', 'when', 'then'])
  .describe(
    "Which part of a scenario a step is: 'given' sets the starting state, 'when' is the action, 'then' the outcome.",
  );
export type ScenarioStepKind = z.infer<typeof ScenarioStepKind>;

export const ScenarioStep = z
  .strictObject({ kind: ScenarioStepKind, text: z.string() })
  .describe('One step of a scenario: its kind and what it says.');
export type ScenarioStep = z.infer<typeof ScenarioStep>;

export const ScenarioSteps = z
  .array(ScenarioStep)
  .min(1)
  .describe(
    'The steps in reading order; each kind may repeat or be left out, but there is at least one step. Consecutive steps of one kind read as "And".',
  );

export const ScannedScenario = z
  .strictObject({
    name: ElementName,
    description: z.string().nullable().default(null),
    steps: z.array(ScenarioStep).default([]),
  })
  .describe(
    'A scenario as a scan found it: code carries its title and little else, so the description and the steps may be missing.',
  );
export type ScannedScenario = z.infer<typeof ScannedScenario>;

export const ScannedRule = z
  .strictObject({
    name: ElementName,
    category: RuleCategory.default('Business'),
    ruleType: RuleType,
    description: z.string().nullable().default(null),
    scenarios: z.array(ScannedScenario).default([]),
  })
  .describe(
    'A rule the element that holds it follows, with the scenarios that illustrate it.',
  );
export type ScannedRule = z.infer<typeof ScannedRule>;

/* The elements, in the order the model lists them. */

export const ScannedDomainModule = ScannedElement.extend({
  id: ModuleId,
  rules: z.array(ScannedRule).default([]),
}).describe(
  "A module: a package or namespace of the code that groups building blocks and other modules; 'module_contains_module' relations name the modules in it, 'module_contains_block' relations the blocks.",
);
export type ScannedDomainModule = z.infer<typeof ScannedDomainModule>;

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
  ])
  .describe(
    "What a building block is. The domain's values: 'aggregate', 'entity', 'value_object'. The parts that do the work: 'domain_service', 'application_service', 'repository', 'factory', 'external_integration'.",
  );
export type BuildingBlockType = z.infer<typeof BuildingBlockType>;

export const ScannedBuildingBlock = ScannedElement.extend({
  id: BuildingBlockId,
  type: BuildingBlockType,
  rules: z.array(ScannedRule).default([]),
  scenarios: z.array(ScannedScenario).default([]),
}).describe(
  'A building block: a class, interface, struct or enum of the code that an annotation names as one of the types; its state and the behaviors it exposes are relations.',
);
export type ScannedBuildingBlock = z.infer<typeof ScannedBuildingBlock>;

export const BehaviorType = z
  .enum(['Command', 'Event', 'Query'])
  .describe(
    "What a behavior does: a 'Command' changes state, an 'Event' says something happened, a 'Query' asks for data.",
  );
export type BehaviorType = z.infer<typeof BehaviorType>;

export const Visibility = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('private') }),
    z.strictObject({ kind: z.literal('public'), actors: z.array(z.string()) }),
  ])
  .describe(
    "Who may call a behavior: 'private' nobody outside the code, 'public' the actors it names.",
  );
export type Visibility = z.infer<typeof Visibility>;

export const ScannedBehavior = ScannedElement.extend({
  id: BehaviorId,
  type: BehaviorType,
  visibility: Visibility,
  rules: z.array(ScannedRule).default([]),
  scenarios: z.array(ScannedScenario).default([]),
}).describe(
  "A behavior: a public method of a building block, named by the block's id path and its own name; its inputs, output and the behaviors it invokes ('behavior_invokes_behavior') are relations.",
);
export type ScannedBehavior = z.infer<typeof ScannedBehavior>;

/* What types a slot — a piece of state, an input, an output — and how many values it holds. */

const PRIMITIVE_KIND = 'primitive';

/** The model's built-in types, the part after `primitive|`. */
export const PrimitiveName = z.enum([
  'string',
  'integer',
  'decimal',
  'boolean',
  'date',
  'datetime',
  'duration',
  'uuid',
]);
export type PrimitiveName = z.infer<typeof PrimitiveName>;

export const PrimitiveId = z
  .templateLiteral([`${PRIMITIVE_KIND}|`, PrimitiveName])
  .describe(
    `A built-in building block's id: '${PRIMITIVE_KIND}|', then one of ${PrimitiveName.options.join(', ')}, e.g. '${PRIMITIVE_KIND}|uuid'.`,
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
  .enum(['0..1', '1', '*'])
  .describe(
    "How many values the slot holds: '1' exactly one, '0..1' one or none, '*' any number. A collection is '*' whether or not it may be empty: the code does not say.",
  );
export type Cardinality = z.infer<typeof Cardinality>;

/**
 * A named slot: a relation its holder may have several of to one type, so
 * it is one of a kind by its holder and `name`, never by `to`, and holds
 * `cardinality` of what it points at. A design may then change what it
 * points at, and how many, in place.
 */
const NamedSlotRelation = ScannedRelation.extend({
  name: ElementName,
  cardinality: Cardinality,
});

/* The relations, one schema a kind, then their union. */

export const ModuleContainsModuleRelation = ScannedRelation.extend({
  kind: z.literal('module_contains_module'),
  from: ModuleId,
  to: ModuleId,
}).describe(
  "A module holds a module, `to`'s id path being `from`'s path and its own name.",
);

export const ModuleContainsBlockRelation = ScannedRelation.extend({
  kind: z.literal('module_contains_block'),
  from: ModuleId,
  to: BuildingBlockId,
}).describe(
  "A module declares a building block, `to`'s id path being `from`'s path and its own name.",
);

export const ExtendsRelation = ScannedRelation.extend({
  kind: z.literal('extends'),
  from: BuildingBlockId,
  to: BuildingBlockId,
}).describe('A building block extends or implements another.');

export const HasStateRelation = NamedSlotRelation.extend({
  kind: z.literal('has_state'),
  from: BuildingBlockId,
  to: TypeId,
}).describe(
  "A building block's piece of state: a field or property named `name`, typed by `to`, holding `cardinality` values.",
);

export const ExposesRelation = ScannedRelation.extend({
  kind: z.literal('exposes'),
  from: BuildingBlockId,
  to: BehaviorId,
}).describe(
  "A building block exposes a behavior; the behavior's id path is the block's path and its own name.",
);

export const HasInputRelation = NamedSlotRelation.extend({
  kind: z.literal('has_input'),
  from: BehaviorId,
  to: TypeId,
  position: z
    .int()
    .min(1)
    .describe(
      'Where the parameter stands in the signature, counting from 1; the parameters of a behavior read in this order.',
    ),
}).describe(
  'A parameter of a behavior: named `name`, typed by `to`, holding `cardinality` values, the `position`th of its signature.',
);

export const HasOutputRelation = NamedSlotRelation.extend({
  kind: z.literal('has_output'),
  from: BehaviorId,
  to: TypeId,
  name: z
    .literal(OUTPUT_NAME)
    .describe(
      "Always 'result': a return value has no name of its own, and the slot is known by it so its type may change in place.",
    ),
}).describe(
  "What a behavior gives back: the slot named 'result', typed by `to`, holding `cardinality` values; a behavior has at most one.",
);

export const BehaviorInvokesBehaviorRelation = ScannedRelation.extend({
  kind: z.literal('behavior_invokes_behavior'),
  from: BehaviorId,
  to: BehaviorId,
  order: z
    .int()
    .min(1)
    .describe(
      'The position of the call within the calling behavior, counting from 1; a behavior called twice keeps its first.',
    ),
}).describe(
  'A behavior calls another behavior, as its `order`th call; a behavior never calls itself.',
);

export const Relation = z.discriminatedUnion('kind', [
  ModuleContainsModuleRelation,
  ModuleContainsBlockRelation,
  ExtendsRelation,
  HasStateRelation,
  ExposesRelation,
  HasInputRelation,
  HasOutputRelation,
  BehaviorInvokesBehaviorRelation,
]);
export type Relation = z.infer<typeof Relation>;

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
    relations: z.array(Relation).default([]),
  })
  .describe(
    'The implemented model as one scan found it: graph/system-models/YYYY-MM-DD_HH-MM_<commit>.json, the scan minute in UTC. Every scan is kept, except that one in the same minute on the same commit replaces the one before; the highest id is the newest.',
  );
export type SystemModel = z.infer<typeof SystemModel>;
