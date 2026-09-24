import { z } from 'zod';
import {
  BehaviorId,
  BuildingBlockId,
  ElementName,
  ModuleId,
} from '#backend/app/element-id';
import { DesignDocField } from './design-doc-field';

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
 * A design doc field the document may leave out altogether: an absent field
 * is parsed as an empty one, which its own defaults read as a `null` set
 * by an agent.
 */
function optionalDesignDocField<Value extends z.ZodType>(value: Value) {
  return DesignDocField(value.nullable().default(null)).prefault({});
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
  name: DesignDocField(ElementName),
  type: optionalDesignDocField(z.string()),
  description: optionalDesignDocField(z.string()),
  nullable: z.boolean().optional(),
  collection: z.boolean().optional(),
});
export type DesignedProperty = z.infer<typeof DesignedPropertySchema>;

export const DesignedRuleSchema = z.object({
  name: DesignDocField(ElementName),
  ruleType: DesignedRuleTypeSchema.nullable().default(null),
  description: optionalDesignDocField(z.string()),
});
export type DesignedRule = z.infer<typeof DesignedRuleSchema>;

export const DesignedScenarioSchema = z.object({
  name: DesignDocField(ElementName),
  description: DesignDocField(z.string()),
  given: DesignDocField(z.string()),
  when: DesignDocField(z.string()),
  // Gherkin's own word, and the shape the document renders. A parsed
  // scenario is never awaited, so its `then` field is never called.
  // oxlint-disable-next-line unicorn/no-thenable
  then: DesignDocField(z.string()), // NOSONAR
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
  description: optionalDesignDocField(z.string()),
});
export type DesignedDomainModule = z.infer<typeof DesignedDomainModuleSchema>;

export const DesignedBuildingBlockSchema = z.object({
  /** Names the module too: `ModuleId.containing(id)`. */
  id: BuildingBlockId,
  type: optionalDesignDocField(DesignedBuildingBlockTypeSchema),
  description: optionalDesignDocField(z.string()),
  implements: z.array(BuildingBlockId).optional(),
  properties: DesignedPropertyChangeSetSchema.optional(),
  rules: DesignedRuleChangeSetSchema.optional(),
  scenarios: DesignedScenarioChangeSetSchema.optional(),
});
export type DesignedBuildingBlock = z.infer<typeof DesignedBuildingBlockSchema>;

export const DesignedBehaviourSchema = z.object({
  /** Names the building block too: `BuildingBlockId.containing(id)`, `ModuleId.containing(id)`. */
  id: BehaviorId,
  description: optionalDesignDocField(z.string()),
  type: optionalDesignDocField(DesignedBehaviourTypeSchema),
  input: StringChangeSetSchema.optional(),
  output: StringChangeSetSchema.optional(),
  usedBuildingBlocks: BuildingBlockIdChangeSetSchema.optional(),
  rules: DesignedRuleChangeSetSchema.optional(),
  scenarios: DesignedScenarioChangeSetSchema.optional(),
  isPublic: z.boolean().default(false),
  actor: optionalDesignDocField(z.string()),
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

const designDocumentSchema = z.object({
  id: z.string(),
  name: DesignDocField(z.string()),
  description: DesignDocField(z.string()),
  modules: DesignedDomainModuleChangeSetSchema.prefault({}),
  buildingBlocks: DesignedBuildingBlockChangeSetSchema.prefault({}),
  behaviours: DesignedBehaviourChangeSetSchema.prefault({}),
  implemented: z.boolean().default(false),
});

export const DesignDocument = Object.assign(designDocumentSchema, {
  /*
   * Checks a version of `existing` an agent wrote. A value a human set must
   * come back accepted by a human, and the agent never claims a value as set
   * by a human. A field is matched by its path, where an item of a list is
   * named by its key: its id, or the value of its name.
   */
  validateAgentVersion: (
    existing: DesignDocument,
    agentVersion: DesignDocument,
  ): DesignDocViolation[] => {
    const agentFields = new Map(fieldsOf(agentVersion, ''));
    const notAccepted = [...fieldsOf(existing, '')]
      .filter(
        ([path, field]) =>
          field.status === 'setByHuman' &&
          agentFields.get(path)?.status !== 'acceptedByHuman',
      )
      .map(([path]) => ({ path, reason: 'humanValueNotAccepted' as const }));
    const claimed = [...agentFields]
      .filter(([, field]) => field.status === 'setByHuman')
      .map(([path]) => ({ path, reason: 'setByHumanClaimedByAgent' as const }));
    return [...notAccepted, ...claimed];
  },
});
export type DesignDocument = z.infer<typeof designDocumentSchema>;

export interface DesignDocViolation {
  /** Where the field is, e.g. `buildingBlocks.added[building_block|sales.Refund].description`. */
  path: string;
  reason: 'humanValueNotAccepted' | 'setByHumanClaimedByAgent';
}

/** The JSON form: what an agent writes, what the store holds, what the wire carries. */
export type DesignDocumentInput = z.input<typeof designDocumentSchema>;

/**
 * Derived from the stored shape so the two can never drift: the service mints
 * the id, so a caller adding a design document does not supply one.
 */
export const CreateDesignDocumentSchema = designDocumentSchema
  .omit({
    id: true,
  })
  .describe('The design document to add to a change.');
export type CreateDesignDocument = z.output<typeof CreateDesignDocumentSchema>;

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

/* Every field under `node`, with its path. */
function* fieldsOf(
  node: unknown,
  path: string,
): Generator<[string, DesignDocField<unknown>]> {
  if (DesignDocField.is(node)) {
    yield [path, node];
  } else if (Array.isArray(node)) {
    for (const item of node) yield* fieldsOf(item, `${path}[${keyOf(item)}]`);
  } else if (typeof node === 'object' && node !== null) {
    for (const [name, child] of Object.entries(node)) {
      yield* fieldsOf(child, path === '' ? name : `${path}.${name}`);
    }
  }
}

/* An element's id, or a part's name; a plain list item is its own key. */
function keyOf(item: unknown): string {
  if (typeof item !== 'object' || item === null) return String(item);
  if ('id' in item && typeof item.id === 'string') return item.id;
  if ('name' in item && DesignDocField.is(item.name)) {
    return String(item.name.value);
  }
  return '';
}
