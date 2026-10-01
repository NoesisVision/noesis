import { z } from 'zod';
import type { Now } from '#backend/app/clock';
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

export const DesignedScenario = z.strictObject({
  name: ElementName,
  description: DesignDocField(z.string()),
  given: DesignDocField(z.string()),
  when: DesignDocField(z.string()),
  // oxlint-disable-next-line unicorn/no-thenable
  then: DesignDocField(z.string()), // NOSONAR
});
export type DesignedScenario = z.infer<typeof DesignedScenario>;

export const DesignedProperty = z.strictObject({
  name: ElementName,
  type: DesignDocField(BuildingBlockRef),
  description: DesignDocField(z.string()),
  optional: DesignDocField(z.boolean()),
});
export type DesignedProperty = z.infer<typeof DesignedProperty>;

export const DesignedParameter = z.strictObject({
  name: ElementName,
  type: DesignDocField(BuildingBlockRef),
  description: DesignDocField(z.string()),
  optional: DesignDocField(z.boolean()),
});
export type DesignedParameter = z.infer<typeof DesignedParameter>;

/** What a behaviour gives back: it has no name, so its type is its key. */
export const DesignedResult = z.strictObject({
  type: BuildingBlockRef.describe(
    'What the behaviour gives back, which is also how the design names it: a changed type is one result removed and another added.',
  ),
  description: DesignDocField(z.string()),
  optional: DesignDocField(z.boolean()),
});
export type DesignedResult = z.infer<typeof DesignedResult>;

export const DesignedRule = z.strictObject({
  name: ElementName,
  ruleType: DesignDocField(RuleType),
  description: DesignDocField(z.string()),
  scenarios: changeSet(DesignedScenario, ElementName),
});
export type DesignedRule = z.infer<typeof DesignedRule>;

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
  rules: changeSet(DesignedRule, ElementName),
  scenarios: changeSet(DesignedScenario, ElementName),
});
export type DesignedBuildingBlock = z.infer<typeof DesignedBuildingBlock>;

export const DesignedBehaviour = z.strictObject({
  id: BehaviorId,
  name: DesignDocField(ElementName),
  type: DesignDocField(BehaviourType),
  description: DesignDocField(z.string()),
  visibility: DesignDocField(Visibility),
  input: changeSet(DesignedParameter, ElementName),
  output: changeSet(DesignedResult, BuildingBlockRef),
  rules: changeSet(DesignedRule, ElementName),
  scenarios: changeSet(DesignedScenario, ElementName),
});
export type DesignedBehaviour = z.infer<typeof DesignedBehaviour>;

const designDocumentSchema = z.strictObject({
  id: DesignDocId.describe(
    "The design document id: its creation date, then its name as lower-case kebab-case, e.g. '2026-09-24-partial-refunds'; unique within the change. Minted by the server when the design document is created and never changed, even when the name is.",
  ),
  name: z.string().describe('The design document name.'),
  description: z.string(),
  modules: changeSet(DesignedDomainModule, ModuleId),
  buildingBlocks: changeSet(DesignedBuildingBlock, BuildingBlockId),
  behaviours: changeSet(DesignedBehaviour, BehaviorId),
  implemented: z
    .boolean()
    .default(false)
    .describe('Whether the design is marked as implemented.'),
  implementedAt: z.iso
    .datetime()
    .nullable()
    .default(null)
    .describe(
      'When the design was marked as implemented, as an ISO 8601 UTC instant the server stamps. Null while it is not, and on a design marked before the server kept the time.',
    ),
});

export const DesignDocument = Object.assign(designDocumentSchema, {
  /** A human may write a field in their own name. */
  validateHumanEdited: rulesOfEveryDesign,
  /** An agent never writes a field in a human's name. */
  validateAgentGenerated: (
    document: DesignDocumentContent,
    systemModel?: SystemModel,
  ): DesignDocViolation[] => [
    ...rulesOfEveryDesign(document, systemModel),
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
// TODO: Czy to jest optymalne rozwiązanie? Może przenieść jako kontrakt serwisu aplikacyjnego - command CreateDesignDocument.
export const DesignDocumentContent = designDocumentSchema.omit({
  id: true,
  implementedAt: true,
});
export type DesignDocumentContent = z.infer<typeof DesignDocumentContent>;

/**
 * When the design became implemented: stamped as it is marked, kept while it
 * stays marked, cleared when it is not.
 */
export function implementedAtOf(
  design: DesignDocumentContent,
  before: DesignDocument | null,
  now: Now,
): string | null {
  if (!design.implemented) return null;
  return before?.implemented ? before.implementedAt : now();
}

export type DesignedDomainModuleInput = z.input<typeof DesignedDomainModule>;
export type DesignedBuildingBlockInput = z.input<typeof DesignedBuildingBlock>;
export type DesignedBehaviourInput = z.input<typeof DesignedBehaviour>;
export type DesignedPropertyInput = z.input<typeof DesignedProperty>;
export type DesignedParameterInput = z.input<typeof DesignedParameter>;
export type DesignedResultInput = z.input<typeof DesignedResult>;
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

/**
 * The rules a design document follows, whoever wrote it. Without a system
 * model it is a green field: there is nothing to modify or remove.
 */
function rulesOfEveryDesign(
  document: DesignDocumentContent,
  systemModel?: SystemModel,
): DesignDocViolation[] {
  return [
    ...changesMissingFrom(systemModel, document),
    ...unchangedFieldsInAddedItems(document),
  ];
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
  // A behaviour's result, designed or scanned, is known by its type.
  if ('type' in item) return keyOf(item.type);
  return JSON.stringify(item);
}
