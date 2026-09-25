import { z } from 'zod';
import {
  BehaviorId,
  BuildingBlockId,
  ElementName,
  ModuleId,
} from '#backend/app/element-id';
import {
  BehaviourType,
  BuildingBlockType,
  RuleType,
  BuildingBlockRef,
  Visibility,
} from '#backend/app/system-model/system-model';
import { DesignDocField } from './design-doc-field';
import { DesignDocId } from './design-doc-id';

export const DesignedProperty = z.object({
  name: ElementName,
  type: DesignDocField(BuildingBlockRef),
  description: DesignDocField(z.string()),
  optional: DesignDocField(z.boolean()),
});
export type DesignedProperty = z.infer<typeof DesignedProperty>;

export const DesignedRule = z.object({
  name: ElementName,
  ruleType: DesignDocField(RuleType),
  description: DesignDocField(z.string()),
});
export type DesignedRule = z.infer<typeof DesignedRule>;

export const DesignedScenario = z.object({
  name: ElementName,
  description: DesignDocField(z.string()),
  given: DesignDocField(z.string()),
  when: DesignDocField(z.string()),
  // oxlint-disable-next-line unicorn/no-thenable
  then: DesignDocField(z.string()), // NOSONAR
});
export type DesignedScenario = z.infer<typeof DesignedScenario>;

export const DesignedDomainModule = z.object({
  id: ModuleId,
  name: DesignDocField(ElementName),
  description: DesignDocField(z.string()),
});
export type DesignedDomainModule = z.infer<typeof DesignedDomainModule>;

export const DesignedBuildingBlock = z.object({
  id: BuildingBlockId,
  name: DesignDocField(ElementName),
  type: DesignDocField(BuildingBlockType),
  description: DesignDocField(z.string()),
  implements: changeSetSchema(BuildingBlockId),
  properties: changeSetSchema(DesignedProperty, ElementName),
  rules: changeSetSchema(DesignedRule, ElementName),
  scenarios: changeSetSchema(DesignedScenario, ElementName),
});
export type DesignedBuildingBlock = z.infer<typeof DesignedBuildingBlock>;

export const DesignedBehaviour = z.object({
  id: BehaviorId,
  name: DesignDocField(ElementName),
  type: DesignDocField(BehaviourType),
  description: DesignDocField(z.string()),
  visibility: DesignDocField(Visibility),
  input: changeSetSchema(BuildingBlockRef),
  output: changeSetSchema(BuildingBlockRef),
  usedBuildingBlocks: changeSetSchema(BuildingBlockId),
  rules: changeSetSchema(DesignedRule, ElementName),
  scenarios: changeSetSchema(DesignedScenario, ElementName),
});
export type DesignedBehaviour = z.infer<typeof DesignedBehaviour>;

const designDocumentSchema = z.object({
  id: DesignDocId.describe(
    "The design document id: its creation date, then its name as lower-case kebab-case, e.g. '2026-09-24-partial-refunds'; unique within the change. Minted by the server when the design document is created and never changed, even when the name is.",
  ),
  name: z.string(),
  description: z.string(),
  modules: changeSetSchema(DesignedDomainModule, ModuleId),
  buildingBlocks: changeSetSchema(DesignedBuildingBlock, BuildingBlockId),
  behaviours: changeSetSchema(DesignedBehaviour, BehaviorId),
  implemented: z.boolean().default(false),
});

export const DesignDocument = Object.assign(designDocumentSchema, {
  validateAddedItems: (document: DesignDocumentContent): DesignDocViolation[] =>
    [...fieldsOf(document, '')]
      .filter(([path, field]) => !field.changed && isInAddedItem(path))
      .map(([path]) => ({ path, reason: 'unchangedFieldInAddedItem' })),
  validateAgentVersion: (
    existing: DesignDocument,
    agentVersion: DesignDocument,
  ): DesignDocViolation[] => {
    const before = humanFieldsOf(existing);
    const after = humanFieldsOf(agentVersion);
    return [...new Set([...before.keys(), ...after.keys()])]
      .filter((path) => before.get(path) !== after.get(path))
      .map((path) => ({
        path,
        reason: before.has(path) ? 'humanValueChanged' : 'humanAuthorClaimed',
      }));
  },
});
export type DesignDocument = z.infer<typeof designDocumentSchema>;

export interface DesignDocViolation {
  path: string;
  reason:
    | 'humanValueChanged'
    | 'humanAuthorClaimed'
    | 'unchangedFieldInAddedItem';
}

export type DesignDocumentInput = z.input<typeof designDocumentSchema>;

/** The working file of a design document: the server mints the id of a new one; an update names it beside the file. */
export const DesignDocumentContent = designDocumentSchema.omit({
  id: true,
});
export type DesignDocumentContent = z.infer<typeof DesignDocumentContent>;

export type DesignedDomainModuleInput = z.input<typeof DesignedDomainModule>;
export type DesignedBuildingBlockInput = z.input<typeof DesignedBuildingBlock>;
export type DesignedBehaviourInput = z.input<typeof DesignedBehaviour>;
export type DesignedPropertyInput = z.input<typeof DesignedProperty>;
export type DesignedRuleInput = z.input<typeof DesignedRule>;
export type DesignedScenarioInput = z.input<typeof DesignedScenario>;

type ChangeSet<
  Item extends z.ZodType,
  Key extends z.ZodType = never,
> = z.ZodPrefault<
  z.ZodObject<
    [Key] extends [never]
      ? {
          added: z.ZodDefault<z.ZodArray<Item>>;
          removed: z.ZodDefault<z.ZodArray<Item>>;
        }
      : {
          added: z.ZodDefault<z.ZodArray<Item>>;
          removed: z.ZodDefault<z.ZodArray<Key>>;
          modified: z.ZodDefault<z.ZodArray<Item>>;
        }
  >
>;

function changeSetSchema<Item extends z.ZodType>(item: Item): ChangeSet<Item>;
function changeSetSchema<Item extends z.ZodType, Key extends z.ZodType>(
  item: Item,
  key: Key,
): ChangeSet<Item, Key>;
function changeSetSchema(item: z.ZodType, key?: z.ZodType) {
  if (key === undefined) {
    return z
      .object({
        added: z.array(item).default([]),
        removed: z.array(item).default([]),
      })
      .prefault({});
  }
  return z
    .object({
      added: z.array(item).default([]),
      removed: z.array(key).default([]),
      modified: z.array(item).default([]),
    })
    .prefault({});
}

function isInAddedItem(path: string): boolean {
  return /(?:^|\.)added\[/.test(path);
}

function humanFieldsOf(document: DesignDocument): Map<string, string> {
  return new Map(
    [...fieldsOf(document, '')]
      .filter(([, field]) => field.author === 'human')
      .map(([path, field]) => [path, JSON.stringify(field)]),
  );
}

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

function keyOf(item: unknown): string {
  if (typeof item !== 'object' || item === null) return String(item);
  if ('id' in item && typeof item.id === 'string') return item.id;
  if ('name' in item && typeof item.name === 'string') return item.name;
  return JSON.stringify(item);
}
