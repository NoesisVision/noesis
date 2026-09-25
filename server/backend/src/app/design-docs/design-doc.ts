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
  type SystemModel,
  Visibility,
} from '#backend/app/system-model/system-model';
import { DesignDocField } from './design-doc-field';
import { DesignDocId } from './design-doc-id';

export const DesignedProperty = z.strictObject({
  name: ElementName,
  type: DesignDocField(BuildingBlockRef),
  description: DesignDocField(z.string()),
  optional: DesignDocField(z.boolean()),
});
export type DesignedProperty = z.infer<typeof DesignedProperty>;

export const DesignedRule = z.strictObject({
  name: ElementName,
  ruleType: DesignDocField(RuleType),
  description: DesignDocField(z.string()),
});
export type DesignedRule = z.infer<typeof DesignedRule>;

export const DesignedScenario = z.strictObject({
  name: ElementName,
  description: DesignDocField(z.string()),
  given: DesignDocField(z.string()),
  when: DesignDocField(z.string()),
  // oxlint-disable-next-line unicorn/no-thenable
  then: DesignDocField(z.string()), // NOSONAR
});
export type DesignedScenario = z.infer<typeof DesignedScenario>;

export const DesignedDomainModule = z.strictObject({
  id: ModuleId,
  name: DesignDocField(ElementName),
  description: DesignDocField(z.string()),
});
export type DesignedDomainModule = z.infer<typeof DesignedDomainModule>;

export const DesignedBuildingBlock = z.strictObject({
  id: BuildingBlockId,
  name: DesignDocField(ElementName),
  type: DesignDocField(BuildingBlockType),
  description: DesignDocField(z.string()),
  implements: changeSet(BuildingBlockId),
  properties: changeSet(DesignedProperty, ElementName),
  // TODO: Skanery na razie nie będą zwracać Rules (bo nie ma jak) więc wszystkie reguły będą zawsze jako dodane.
  rules: changeSet(DesignedRule, ElementName),
  // TODO: Na tym poziomie (wymaga  relacji 1 - 1), czy osobno?
  scenarios: changeSet(DesignedScenario, ElementName),
});
export type DesignedBuildingBlock = z.infer<typeof DesignedBuildingBlock>;

export const DesignedBehaviour = z.strictObject({
  id: BehaviorId,
  name: DesignDocField(ElementName),
  type: DesignDocField(BehaviourType),
  description: DesignDocField(z.string()),
  visibility: DesignDocField(Visibility),
  input: changeSet(BuildingBlockRef),
  output: changeSet(BuildingBlockRef),
  // TODO: Czy to jest potrzebne? Co z invokes?
  usedBuildingBlocks: changeSet(BuildingBlockId),
  // TODO: Skanery na razie nie będą zwracać Rules (bo nie ma jak) więc wszystkie reguły będą zawsze jako dodane.
  rules: changeSet(DesignedRule, ElementName),
  // TODO: Na tym poziomie (wymaga  relacji 1 - 1), czy osobno?
  scenarios: changeSet(DesignedScenario, ElementName),
});
export type DesignedBehaviour = z.infer<typeof DesignedBehaviour>;

const designDocumentSchema = z.strictObject({
  id: DesignDocId.describe(
    "The design document id: its creation date, then its name as lower-case kebab-case, e.g. '2026-09-24-partial-refunds'; unique within the change. Minted by the server when the design document is created and never changed, even when the name is.",
  ),
  name: z.string(),
  description: z.string(),
  // TODO: 3 listy, czy 1?
  modules: changeSet(DesignedDomainModule, ModuleId),
  buildingBlocks: changeSet(DesignedBuildingBlock, BuildingBlockId),
  behaviours: changeSet(DesignedBehaviour, BehaviorId),
  implemented: z.boolean().default(false),
});

export const DesignDocument = Object.assign(designDocumentSchema, {
  /**
   * The rules a design document written by an agent follows. Without a
   * system model it is a green field: there is nothing to modify or remove.
   */
  validateAgentGenerated: (
    document: DesignDocumentContent,
    systemModel?: SystemModel,
  ): DesignDocViolation[] => [
    ...changesMissingFrom(systemModel, document),
    ...unchangedFieldsInAddedItems(document),
    ...humanAuthoredFields(document),
  ],
});
export type DesignDocument = z.infer<typeof designDocumentSchema>;

export interface DesignDocViolation {
  path: string;
  reason:
    | 'changedInGreenField'
    | 'unknownElement'
    | 'unchangedFieldInAddedItem'
    | 'humanAuthor';
}

export type DesignDocumentInput = z.input<typeof designDocumentSchema>;

/** The working file of a design document: the server mints the id of a new one; an update names it beside the file. */
// TODO: Czy to jest optymalne rozwiązanie?
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
        },
    z.core.$strict
  >
>;

function changeSet<Item extends z.ZodType>(item: Item): ChangeSet<Item>;
function changeSet<Item extends z.ZodType, Key extends z.ZodType>(
  item: Item,
  key: Key,
): ChangeSet<Item, Key>;
function changeSet(item: z.ZodType, key?: z.ZodType) {
  if (key === undefined) {
    return z
      .strictObject({
        added: z.array(item).default([]),
        removed: z.array(item).default([]),
      })
      .prefault({});
  }
  return z
    .strictObject({
      added: z.array(item).default([]),
      removed: z.array(key).default([]),
      modified: z.array(item).default([]),
    })
    .prefault({});
}

/**
 * Every element or part the document modifies or removes, at any level, that
 * the system model lacks; all of them in a green field. An element's parts
 * are matched by name: a designed block's `properties` against the scanned
 * block's `properties`, and so on. Inside an added element nothing exists yet.
 */
function changesMissingFrom(
  systemModel: SystemModel | undefined,
  document: DesignDocumentContent,
): DesignDocViolation[] {
  const reason =
    systemModel === undefined ? 'changedInGreenField' : 'unknownElement';
  return [...partsMissingFrom(document, systemModel, '')].map((path) => ({
    path,
    reason,
  }));
}

function* partsMissingFrom(
  designed: object,
  scanned: object | undefined,
  path: string,
): Generator<string> {
  for (const [name, part] of Object.entries(designed)) {
    if (!isChangeSet(part)) continue;
    const counterpart: unknown =
      scanned === undefined ? undefined : Reflect.get(scanned, name);
    yield* changesMissingFromPart(
      part,
      Array.isArray(counterpart) ? counterpart : [],
      path === '' ? name : `${path}.${name}`,
    );
  }
}

function* changesMissingFromPart(
  changes: ChangeSetValue,
  scanned: unknown[],
  path: string,
): Generator<string> {
  const known = new Map(scanned.map((item) => [keyOf(item), item]));
  for (const item of changes.added) {
    if (isObject(item)) {
      yield* partsMissingFrom(item, undefined, `${path}.added[${keyOf(item)}]`);
    }
  }
  for (const key of changes.removed.map(keyOf)) {
    if (!known.has(key)) yield `${path}.removed[${key}]`;
  }
  for (const item of changes.modified ?? []) {
    const key = keyOf(item);
    const found = known.get(key);
    if (found === undefined) {
      yield `${path}.modified[${key}]`;
    } else if (isObject(item)) {
      yield* partsMissingFrom(
        item,
        isObject(found) ? found : undefined,
        `${path}.modified[${key}]`,
      );
    }
  }
}

interface ChangeSetValue {
  added: unknown[];
  removed: unknown[];
  modified?: unknown[];
}

function isChangeSet(value: unknown): value is ChangeSetValue {
  return (
    isObject(value) &&
    'added' in value &&
    Array.isArray(value.added) &&
    'removed' in value &&
    Array.isArray(value.removed)
  );
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function unchangedFieldsInAddedItems(
  document: DesignDocumentContent,
): DesignDocViolation[] {
  return [...fieldsOf(document, '')]
    .filter(([path, field]) => !field.changed && isInAddedItem(path))
    .map(([path]) => ({ path, reason: 'unchangedFieldInAddedItem' }));
}

function humanAuthoredFields(
  document: DesignDocumentContent,
): DesignDocViolation[] {
  return [...fieldsOf(document, '')]
    .filter(([, field]) => field.changed && field.author === 'human')
    .map(([path]) => ({ path, reason: 'humanAuthor' }));
}

function isInAddedItem(path: string): boolean {
  return /(?:^|\.)added\[/.test(path);
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
