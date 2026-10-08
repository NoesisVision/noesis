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
  RULE_TYPES_OF,
  RuleCategory,
  RuleType,
  BuildingBlockRef,
  type ScannedRule,
  type SystemModel,
  Visibility,
} from '#backend/app/system-model/system-model';
import { type ChangedDesignDocField, DesignDocField } from './design-doc-field';
import { DesignDocId } from './design-doc-id';
import { MermaidSource } from './mermaid-source';
import { NeedId } from './need-id';

/** A stakeholder goal the design answers: who needs what, never a solution. */
export const DesignedNeed = z.strictObject({
  id: NeedId,
  name: DesignDocField(ElementName),
  stakeholder: DesignDocField(z.string()),
  statement: DesignDocField(z.string()),
});
export type DesignedNeed = z.infer<typeof DesignedNeed>;

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
  category: DesignDocField(RuleCategory),
  ruleType: DesignDocField(RuleType),
  description: DesignDocField(z.string()),
  needs: DesignDocField(
    z
      .array(NeedId)
      .describe(
        'The needs of this design document the rule answers; empty for a design decision no need asks for.',
      ),
  ),
  rationale: DesignDocField(z.string()),
  scenarios: changeSet(DesignedScenario, ElementName),
});
export type DesignedRule = z.infer<typeof DesignedRule>;

export const DesignedDomainModule = z.strictObject({
  id: ModuleId,
  name: DesignDocField(ElementName),
  definition: DesignDocField(z.string()),
  diagram: DesignDocField(MermaidSource),
  rules: changeSet(DesignedRule, ElementName),
});
export type DesignedDomainModule = z.infer<typeof DesignedDomainModule>;

export const DesignedBuildingBlock = z.strictObject({
  id: BuildingBlockId,
  name: DesignDocField(ElementName),
  type: DesignDocField(BuildingBlockType),
  definition: DesignDocField(z.string()),
  diagram: DesignDocField(MermaidSource),
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
  definition: DesignDocField(z.string()),
  diagram: DesignDocField(MermaidSource),
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
  description: z
    .string()
    .describe(
      "The design's overview, read first when it is opened: a short guide to its changes in the model, from the general to the particular, in Markdown of at most about 60 lines. States facts the design shows or its sources state, and cites the source for every reason. Links elements with 'noesis:' and the element's id, e.g. '[Refund](noesis:building_block|sales.refunds.Refund)', and needs with 'noesis:need|' and the need's id.",
    ),
  needs: changeSet(DesignedNeed, NeedId),
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
  /**
   * An agent never writes a field in a human's name. Revising `before`, it
   * keeps a field a human wrote or accepted there, value and author, as long
   * as it leaves the field alone.
   */
  validateAgentGenerated: (
    document: DesignDocumentContent,
    systemModel?: SystemModel,
    before?: DesignDocumentContent,
  ): DesignDocViolation[] => [
    ...rulesOfEveryDesign(document, systemModel),
    ...humanAuthoredFieldsNotKept(document, before),
    ...diagramsInDefinitions(document),
  ],
});
export type DesignDocument = z.infer<typeof designDocumentSchema>;

export interface DesignDocViolation {
  path: string;
  reason:
    | 'changedInGreenField'
    | 'unknownElement'
    | 'unchangedFieldInAddedItem'
    | 'humanAuthor'
    | 'diagramInDefinition'
    | 'unknownNeed'
    | 'ruleTypeOutsideCategory'
    | 'businessRuleOnModule';
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
export type DesignedNeedInput = z.input<typeof DesignedNeed>;
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
  const rules = [...rulesIn(document, systemModel)];
  return [
    ...changesMissingFrom(systemModel, document),
    ...unchangedFieldsInAddedItems(document),
    ...unknownNeeds(document, rules),
    ...ruleTypesOutsideCategory(rules),
    ...businessRulesOnModules(rules),
  ];
}

const ELEMENT_COLLECTIONS = [
  'modules',
  'buildingBlocks',
  'behaviours',
] as const;
type ElementCollection = (typeof ELEMENT_COLLECTIONS)[number];

interface DesignedElementWithRules {
  id: string;
  rules: { added: DesignedRule[]; modified: DesignedRule[] };
}

interface ScannedElementWithRules {
  id: string;
  rules: ScannedRule[];
}

/** A rule the design adds or modifies, and the scanned rule a modified one changes. */
interface RuleInDesign {
  path: string;
  collection: ElementCollection;
  designed: DesignedRule;
  scanned: ScannedRule | undefined;
}

function* rulesIn(
  document: DesignDocumentContent,
  systemModel: SystemModel | undefined,
): Generator<RuleInDesign> {
  for (const collection of ELEMENT_COLLECTIONS) {
    const scannedElements: readonly ScannedElementWithRules[] =
      systemModel?.[collection] ?? [];
    for (const kind of ['added', 'modified'] as const) {
      const elements: readonly DesignedElementWithRules[] =
        document[collection][kind];
      for (const element of elements) {
        const scannedRules =
          kind === 'modified'
            ? (scannedElements.find(({ id }) => id === element.id)?.rules ?? [])
            : [];
        for (const ruleKind of ['added', 'modified'] as const) {
          for (const rule of element.rules[ruleKind]) {
            yield {
              path: `${collection}.${kind}[${element.id}].rules.${ruleKind}[${rule.name}]`,
              collection,
              designed: rule,
              scanned:
                ruleKind === 'modified'
                  ? scannedRules.find(({ name }) => name === rule.name)
                  : undefined,
            };
          }
        }
      }
    }
  }
}

/** A rule traces only to needs this design document states. */
function unknownNeeds(
  document: DesignDocumentContent,
  rules: RuleInDesign[],
): DesignDocViolation[] {
  const stated = new Set<string>(document.needs.added.map(({ id }) => id));
  return rules.flatMap(({ path, designed }) =>
    designed.needs.changed
      ? designed.needs.value
          .filter((need) => !stated.has(need))
          .map((need) => ({
            path: `${path}.needs[${need}]`,
            reason: 'unknownNeed' as const,
          }))
      : [],
  );
}

/** A rule's type is one its category allows, the scanned rule filling in the half a modified one leaves alone. */
function ruleTypesOutsideCategory(rules: RuleInDesign[]): DesignDocViolation[] {
  return rules
    .filter(({ designed, scanned }) => {
      if (!designed.category.changed && !designed.ruleType.changed) {
        return false;
      }
      const category = valueOf(designed.category, scanned?.category);
      const ruleType = valueOf(designed.ruleType, scanned?.ruleType);
      return (
        category !== undefined &&
        ruleType !== undefined &&
        !RULE_TYPES_OF[category].includes(ruleType)
      );
    })
    .map(({ path }) => ({
      path: `${path}.ruleType`,
      reason: 'ruleTypeOutsideCategory',
    }));
}

/** A module holds quality and constraint rules; a domain truth belongs to a building block or a behaviour. */
function businessRulesOnModules(rules: RuleInDesign[]): DesignDocViolation[] {
  return rules
    .filter(
      ({ collection, designed, scanned }) =>
        collection === 'modules' &&
        valueOf(designed.category, scanned?.category) === 'Business',
    )
    .map(({ path }) => ({
      path: `${path}.category`,
      reason: 'businessRuleOnModule',
    }));
}

function valueOf<Value>(
  field: DesignDocField<Value>,
  held: Value | undefined,
): Value | undefined {
  return field.changed ? field.value : held;
}

/**
 * Fields an added element may leave out: the model never has them, so there
 * is nothing for the design to keep.
 */
const OPTIONAL_FIELDS = new Set(['diagram', 'rationale']);

function unchangedFieldsInAddedItems(
  document: DesignDocumentContent,
): DesignDocViolation[] {
  return [...fieldsOf(document, '')]
    .filter(
      ([path, field]) =>
        !field.changed && isInAddedItem(path) && !isOptionalField(path),
    )
    .map(([path]) => ({ path, reason: 'unchangedFieldInAddedItem' }));
}

function isOptionalField(path: string): boolean {
  return OPTIONAL_FIELDS.has(path.slice(path.lastIndexOf('.') + 1));
}

/** The fence a diagram is written in inside markdown. */
const MERMAID_FENCE = /^ {0,3}(?:`{3,}|~{3,})[^\n]*\bmermaid\b/mu;

/**
 * An element with a diagram of its own draws it there, not in a fence of its
 * definition.
 */
function diagramsInDefinitions(
  document: DesignDocumentContent,
): DesignDocViolation[] {
  const collections = {
    modules: document.modules,
    buildingBlocks: document.buildingBlocks,
    behaviours: document.behaviours,
  };
  return Object.entries(collections).flatMap(([name, changes]) =>
    (['added', 'modified'] as const).flatMap((kind) =>
      changes[kind]
        .filter(
          ({ definition }) =>
            definition.changed && MERMAID_FENCE.test(definition.value),
        )
        .map(({ id }) => ({
          path: `${name}.${kind}[${id}].definition`,
          reason: 'diagramInDefinition' as const,
        })),
    ),
  );
}

function humanAuthoredFieldsNotKept(
  document: DesignDocumentContent,
  before: DesignDocumentContent | undefined,
): DesignDocViolation[] {
  const kept = new Map(
    before === undefined
      ? []
      : [...fieldsOf(before, '')].filter(([, field]) => isHumanAuthored(field)),
  );
  return [...fieldsOf(document, '')]
    .filter(
      ([path, field]) =>
        isHumanAuthored(field) && !sameValue(field, kept.get(path)),
    )
    .map(([path]) => ({ path, reason: 'humanAuthor' }));
}

function isHumanAuthored(
  field: DesignDocField<unknown>,
): field is ChangedDesignDocField<unknown> {
  return field.changed && field.author === 'human';
}

function sameValue(
  field: ChangedDesignDocField<unknown>,
  stored: DesignDocField<unknown> | undefined,
): boolean {
  return stored?.changed === true && deepEqual(field.value, stored.value);
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!isObject(left) || !isObject(right)) return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) =>
      deepEqual(Reflect.get(left, key), Reflect.get(right, key)),
    )
  );
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
