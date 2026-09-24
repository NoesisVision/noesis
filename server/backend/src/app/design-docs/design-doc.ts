import { z } from 'zod';
import {
  BehaviorId,
  BuildingBlockId,
  ElementName,
  ModuleId,
} from '#backend/app/element-id';
import { DesignDocId } from './design-doc-id';
import { reviewableFieldSchema } from './reviewable-field';

/*
 * A design is a diff against the scanned model: only the elements it adds,
 * modifies or removes, in one flat change set per kind. Nothing nests. An
 * element names itself by the same id the scanner gives it, and that id
 * already encodes its place: a building block's id names its module, a
 * behaviour's id names its building block, a module's id names its parent
 * module. The hierarchy is rebuilt from the ids when a reader wants it.
 */

export const DesignedBuildingBlockTypeSchema = z.enum([
  'aggregate',
  'entity',
  'value_object',
  'domain_event',
  'domain_command',
  'domain_query',
  'domain_service',
  'application_service',
  'repository',
  'factory',
  'external_integration',
]);
export type DesignedBuildingBlockType = z.infer<
  typeof DesignedBuildingBlockTypeSchema
>;

export const DesignedRuleTypeSchema = z.enum([
  'Consistency',
  'Structure',
  'Computation',
  'State change',
]);
export type DesignedRuleType = z.infer<typeof DesignedRuleTypeSchema>;

export const DesignedBehaviourTypeSchema = z.enum([
  'Command',
  'Event',
  'Query',
]);
export type DesignedBehaviourType = z.infer<typeof DesignedBehaviourTypeSchema>;

/*
 * A reviewable field the document may leave out altogether: an absent field
 * is parsed as an empty one, which its own defaults read as an unreviewed
 * `null` — what a missing value beside an unset lock used to say.
 */
function optionalReviewableField<Value extends z.ZodType>(value: Value) {
  return reviewableFieldSchema(value.nullable().default(null)).prefault({});
}

/*
 * What a design does to one collection: the items it adds, the keys of the
 * items it removes, and the items it modifies. An element's key is its id;
 * a part of an element, such as a property or a rule, is keyed by its name.
 */
function changeSetSchema<Item extends z.ZodType, Key extends z.ZodType>(
  item: Item,
  key: Key,
) {
  return z.object({
    added: z.array(item).default([]),
    removed: z.array(key).default([]),
    modified: z.array(item).default([]),
  });
}

/* The parts of an element. None is an element itself, so none has an id. */

export const DesignedPropertySchema = z.object({
  name: reviewableFieldSchema(ElementName),
  type: optionalReviewableField(z.string()),
  description: optionalReviewableField(z.string()),
  nullable: z.boolean().optional(),
  collection: z.boolean().optional(),
});
export type DesignedProperty = z.infer<typeof DesignedPropertySchema>;

export const DesignedRuleSchema = z.object({
  name: reviewableFieldSchema(ElementName),
  ruleType: DesignedRuleTypeSchema.nullable().default(null),
  description: optionalReviewableField(z.string()),
});
export type DesignedRule = z.infer<typeof DesignedRuleSchema>;

export const DesignedScenarioSchema = z.object({
  name: reviewableFieldSchema(ElementName),
  description: reviewableFieldSchema(z.string()),
  given: reviewableFieldSchema(z.string()),
  when: reviewableFieldSchema(z.string()),
  // Gherkin's own word, and the shape the document renders. A parsed
  // scenario is never awaited, so its `then` field is never called.
  // oxlint-disable-next-line unicorn/no-thenable
  then: reviewableFieldSchema(z.string()), // NOSONAR
});
export type DesignedScenario = z.infer<typeof DesignedScenarioSchema>;

export const StringChangeSetSchema = changeSetSchema(z.string(), z.string());
export type StringChangeSet = z.infer<typeof StringChangeSetSchema>;

export const BuildingBlockIdChangeSetSchema = changeSetSchema(
  BuildingBlockId,
  BuildingBlockId,
);
export type BuildingBlockIdChangeSet = z.infer<
  typeof BuildingBlockIdChangeSetSchema
>;

export const DesignedPropertyChangeSetSchema = changeSetSchema(
  DesignedPropertySchema,
  ElementName,
);
export type DesignedPropertyChangeSet = z.infer<
  typeof DesignedPropertyChangeSetSchema
>;

export const DesignedRuleChangeSetSchema = changeSetSchema(
  DesignedRuleSchema,
  ElementName,
);
export type DesignedRuleChangeSet = z.infer<typeof DesignedRuleChangeSetSchema>;

export const DesignedScenarioChangeSetSchema = changeSetSchema(
  DesignedScenarioSchema,
  ElementName,
);
export type DesignedScenarioChangeSet = z.infer<
  typeof DesignedScenarioChangeSetSchema
>;

/* The elements. Each carries the id the scanner would give it. */

export const DesignedDomainModuleSchema = z.object({
  /** Names the parent module too: `ModuleId.parentOf(id)`, null for a root module. */
  id: ModuleId,
  description: optionalReviewableField(z.string()),
});
export type DesignedDomainModule = z.infer<typeof DesignedDomainModuleSchema>;

export const DesignedBuildingBlockSchema = z.object({
  /** Names the module too: `ModuleId.containing(id)`. */
  id: BuildingBlockId,
  type: optionalReviewableField(DesignedBuildingBlockTypeSchema),
  description: optionalReviewableField(z.string()),
  implements: z.array(BuildingBlockId).optional(),
  properties: DesignedPropertyChangeSetSchema.optional(),
  rules: DesignedRuleChangeSetSchema.optional(),
  scenarios: DesignedScenarioChangeSetSchema.optional(),
});
export type DesignedBuildingBlock = z.infer<typeof DesignedBuildingBlockSchema>;

export const DesignedBehaviourSchema = z.object({
  /** Names the building block too: `BuildingBlockId.containing(id)`, `ModuleId.containing(id)`. */
  id: BehaviorId,
  description: optionalReviewableField(z.string()),
  type: optionalReviewableField(DesignedBehaviourTypeSchema),
  input: StringChangeSetSchema.optional(),
  output: StringChangeSetSchema.optional(),
  usedBuildingBlocks: BuildingBlockIdChangeSetSchema.optional(),
  rules: DesignedRuleChangeSetSchema.optional(),
  scenarios: DesignedScenarioChangeSetSchema.optional(),
  isPublic: z.boolean().default(false),
  actor: optionalReviewableField(z.string()),
});
export type DesignedBehaviour = z.infer<typeof DesignedBehaviourSchema>;

export const DesignedDomainModuleChangeSetSchema = changeSetSchema(
  DesignedDomainModuleSchema,
  ModuleId,
);
export type DesignedDomainModuleChangeSet = z.infer<
  typeof DesignedDomainModuleChangeSetSchema
>;

export const DesignedBuildingBlockChangeSetSchema = changeSetSchema(
  DesignedBuildingBlockSchema,
  BuildingBlockId,
);
export type DesignedBuildingBlockChangeSet = z.infer<
  typeof DesignedBuildingBlockChangeSetSchema
>;

export const DesignedBehaviourChangeSetSchema = changeSetSchema(
  DesignedBehaviourSchema,
  BehaviorId,
);
export type DesignedBehaviourChangeSet = z.infer<
  typeof DesignedBehaviourChangeSetSchema
>;

export const DesignDocumentSchema = z.object({
  id: DesignDocId.describe(
    "The design document id: its creation date, then its name as lower-case kebab-case, e.g. '2026-09-24-partial-refunds'; unique within the change. Minted once by the writer with the plugin's entity-id.ts script and never changed; saving at an existing id updates that design document.",
  ),
  name: reviewableFieldSchema(z.string()),
  description: reviewableFieldSchema(z.string()),
  modules: DesignedDomainModuleChangeSetSchema.prefault({}),
  buildingBlocks: DesignedBuildingBlockChangeSetSchema.prefault({}),
  behaviours: DesignedBehaviourChangeSetSchema.prefault({}),
  implemented: z.boolean().default(false),
});
export type DesignDocument = z.infer<typeof DesignDocumentSchema>;

/** The JSON form: what an agent writes, what the store holds, what the wire carries. */
export type DesignDocumentInput = z.input<typeof DesignDocumentSchema>;

/* The JSON form of each element and part, for readers of the wire. */
export type DesignedDomainModuleInput = z.input<
  typeof DesignedDomainModuleSchema
>;
export type DesignedBuildingBlockInput = z.input<
  typeof DesignedBuildingBlockSchema
>;
export type DesignedBehaviourInput = z.input<typeof DesignedBehaviourSchema>;
export type DesignedPropertyInput = z.input<typeof DesignedPropertySchema>;
export type DesignedRuleInput = z.input<typeof DesignedRuleSchema>;
export type DesignedScenarioInput = z.input<typeof DesignedScenarioSchema>;
