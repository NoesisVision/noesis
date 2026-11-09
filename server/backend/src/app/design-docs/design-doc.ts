import { z } from 'zod';
import type { Clock } from '#backend/app/clock';
import {
  BehaviorId,
  BuildingBlockId,
  ElementId,
  ElementName,
  ModuleId,
} from '#backend/app/element-id';
import {
  BehaviorInvokesBehaviorRelation,
  BehaviorType,
  BuildingBlockType,
  Cardinality,
  ExposesRelation,
  ExtendsRelation,
  HasInputRelation,
  HasOutputRelation,
  HasStateRelation,
  ModuleContainsBlockRelation,
  ModuleContainsModuleRelation,
  RULE_TYPES_OF,
  RuleCategory,
  RuleType,
  ScenarioSteps,
  type ScannedRule,
  type SystemModel,
  TypeId,
  Visibility,
} from '#backend/app/system-model/system-model';
import { type ChangedDesignDocField, DesignDocField } from './design-doc-field';
import { DesignDocId } from './design-doc-id';
import { MermaidSource } from './mermaid-source';
import { NeedId } from './need-id';
import { type RelationKey, relationKeyOf } from './relation-key';

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
  steps: DesignDocField(ScenarioSteps),
});
export type DesignedScenario = z.infer<typeof DesignedScenario>;

/*
 * A relation as a design writes it: the scanned shape, with what is not its
 * identity as fields, so a design may change a slot's type or cardinality, a
 * parameter's position or a call's order in place. Every other relation is
 * its scanned shape as is.
 */
const designedSlot = <To extends z.ZodType>(to: To) => ({
  to: DesignDocField(to),
  cardinality: DesignDocField(Cardinality),
});
export const DesignedRelation = z.discriminatedUnion('kind', [
  ModuleContainsModuleRelation,
  ModuleContainsBlockRelation,
  ExtendsRelation,
  HasStateRelation.extend(designedSlot(TypeId)),
  ExposesRelation,
  HasInputRelation.extend({
    ...designedSlot(TypeId),
    position: DesignDocField(HasInputRelation.shape.position),
  }),
  HasOutputRelation.extend(designedSlot(TypeId)),
  BehaviorInvokesBehaviorRelation.extend({
    order: DesignDocField(BehaviorInvokesBehaviorRelation.shape.order),
  }),
]);
export type DesignedRelation = z.infer<typeof DesignedRelation>;

export const DesignedRelationKey = z
  .discriminatedUnion('kind', [
    ModuleContainsModuleRelation.pick({ kind: true, from: true, to: true }),
    ModuleContainsBlockRelation.pick({ kind: true, from: true, to: true }),
    ExtendsRelation.pick({ kind: true, from: true, to: true }),
    HasStateRelation.pick({ kind: true, from: true, to: true, name: true }),
    ExposesRelation.pick({ kind: true, from: true, to: true }),
    HasInputRelation.pick({ kind: true, from: true, to: true, name: true }),
    HasOutputRelation.pick({ kind: true, from: true, to: true, name: true }),
    BehaviorInvokesBehaviorRelation.pick({ kind: true, from: true, to: true }),
  ])
  .describe(
    "What a design removes a relation by: its kind and both ends, and for a named slot ('has_state', 'has_input', 'has_output') its name too, so the key says what was removed in full.",
  );
export type DesignedRelationKey = z.infer<typeof DesignedRelationKey>;

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
  rules: changeSet(DesignedRule, ElementName),
  scenarios: changeSet(DesignedScenario, ElementName),
});
export type DesignedBuildingBlock = z.infer<typeof DesignedBuildingBlock>;

export const DesignedBehavior = z.strictObject({
  id: BehaviorId,
  name: DesignDocField(ElementName),
  type: DesignDocField(BehaviorType),
  definition: DesignDocField(z.string()),
  diagram: DesignDocField(MermaidSource),
  visibility: DesignDocField(Visibility),
  rules: changeSet(DesignedRule, ElementName),
  scenarios: changeSet(DesignedScenario, ElementName),
});
export type DesignedBehavior = z.infer<typeof DesignedBehavior>;

const designDocumentSchema = z.strictObject({
  id: DesignDocId.describe(
    "The design document id: its creation date, then its name as lower-case kebab-case, e.g. '2026-09-24-partial-refunds'; unique within the change. Minted by the server when the design document is created and never changed, even when the name is.",
  ),
  name: z.string().describe('The design document name.'),
  description: z
    .string()
    .describe(
      "The design's overview, read first when it is opened: a short guide to its changes in the model, from the general to the particular, in Markdown of at most about 60 lines and no diagrams. States facts the design shows or its sources state, and cites the source for every reason. Links elements with 'noesis:' and the element's id, e.g. '[Refund](noesis:building_block|sales.refunds.Refund)', and needs with 'noesis:need|' and the need's id.",
    ),
  needs: changeSet(DesignedNeed, NeedId),
  modules: changeSet(DesignedDomainModule, ModuleId),
  buildingBlocks: changeSet(DesignedBuildingBlock, BuildingBlockId),
  behaviors: changeSet(DesignedBehavior, BehaviorId),
  relations: changeSet(DesignedRelation, DesignedRelationKey).describe(
    "The relations the design adds, removes or changes between elements of the design or the model: what a module contains ('module_contains_module', 'module_contains_block'), what a block extends, holds ('has_state') and exposes, what a behavior takes ('has_input'), gives back ('has_output') and invokes. Both ends of an added or modified relation exist, in the design or the model; a containment agrees with the ids, whose paths already say what holds what.",
  ),
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
    | 'businessRuleOnModule'
    | 'uncontained'
    | 'unknownRelationEnd'
    | 'containmentOutsideIdPath';
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
  clock: Clock,
): string | null {
  if (!design.implemented) return null;
  return before?.implemented ? before.implementedAt : clock.now();
}

export type DesignedDomainModuleInput = z.input<typeof DesignedDomainModule>;
export type DesignedBuildingBlockInput = z.input<typeof DesignedBuildingBlock>;
export type DesignedBehaviorInput = z.input<typeof DesignedBehavior>;
export type DesignedRelationInput = z.input<typeof DesignedRelation>;
export type DesignedRelationKeyInput = z.input<typeof DesignedRelationKey>;
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
 * are matched by name: a designed block's `rules` against the scanned
 * block's `rules`, and so on; a relation by its key. Inside an added element
 * nothing exists yet.
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
    ...uncontainedElements(document),
    ...unchangedFieldsInAddedItems(document),
    ...unknownNeeds(document, rules),
    ...ruleTypesOutsideCategory(rules),
    ...businessRulesOnModules(rules),
    ...unknownRelationEnds(document, systemModel),
    ...containmentsOutsideIdPaths(document),
  ];
}

const ELEMENT_COLLECTIONS = ['modules', 'buildingBlocks', 'behaviors'] as const;
type ElementCollection = (typeof ELEMENT_COLLECTIONS)[number];

/** The relations that place an element under another: the tree of modules, blocks and behaviors. */
const CONTAINMENT_KINDS: ReadonlySet<string> = new Set([
  ModuleContainsModuleRelation.shape.kind.value,
  ModuleContainsBlockRelation.shape.kind.value,
  ExposesRelation.shape.kind.value,
]);

/**
 * An element the design adds under another has the relation that contains
 * it added beside it. A root module is under nothing.
 */
function uncontainedElements(
  document: DesignDocumentContent,
): DesignDocViolation[] {
  const contained = new Set<string>(
    document.relations.added.flatMap((relation) => {
      const to = targetOf(relation);
      return CONTAINMENT_KINDS.has(relation.kind) && to !== undefined
        ? [to]
        : [];
    }),
  );
  return ELEMENT_COLLECTIONS.flatMap((collection) =>
    document[collection].added
      .filter(({ id }) => parentOf(id) !== null && !contained.has(id))
      .map(({ id }) => ({
        path: `${collection}.added[${id}]`,
        reason: 'uncontained' as const,
      })),
  );
}

/** Both ends of every added or modified relation are elements the design adds or the model has; a primitive is always known. */
function unknownRelationEnds(
  document: DesignDocumentContent,
  systemModel: SystemModel | undefined,
): DesignDocViolation[] {
  const known = new Set<string>();
  for (const collection of ELEMENT_COLLECTIONS) {
    for (const { id } of systemModel?.[collection] ?? []) known.add(id);
    for (const { id } of document[collection].added) known.add(id);
  }
  const isUnknown = (id: string | undefined) =>
    id !== undefined && !known.has(id) && !id.startsWith('primitive|');
  return (['added', 'modified'] as const).flatMap((kind) =>
    document.relations[kind].flatMap((relation) =>
      (
        [
          ['from', relation.from],
          ['to', targetOf(relation)],
        ] as const
      )
        .filter(([, id]) => isUnknown(id))
        .map(([end]) => ({
          path: `relations.${kind}[${relationKeyOf(relation)}].${end}`,
          reason: 'unknownRelationEnd' as const,
        })),
    ),
  );
}

/** A relation's `to`, unless it is a field the design leaves alone. */
const targetOf = (relation: DesignedRelation): string | undefined => {
  if (!DesignDocField.is(relation.to)) return relation.to;
  return relation.to.changed ? relation.to.value : undefined;
};

/** What a module holds is in the ids too: `to`'s path is `from`'s path and its own name. */
function containmentsOutsideIdPaths(
  document: DesignDocumentContent,
): DesignDocViolation[] {
  return document.relations.added
    .filter(
      (relation) =>
        (relation.kind === 'module_contains_module' ||
          relation.kind === 'module_contains_block') &&
        parentOf(relation.to) !== relation.from,
    )
    .map((relation) => ({
      path: `relations.added[${relationKeyOf(relation)}]`,
      reason: 'containmentOutsideIdPath' as const,
    }));
}

/** The element an element is under by its id; null for a root module. */
const parentOf = (id: ElementId): ElementId | null =>
  ElementId.match<ElementId | null>(id, {
    module: (module) => ModuleId.parentOf(module),
    buildingBlock: (block) => ModuleId.containing(block),
    behavior: (behavior) => BuildingBlockId.containing(behavior),
  });

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

/** A module holds quality and constraint rules; a domain truth belongs to a building block or a behavior. */
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
    behaviors: document.behaviors,
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
  if (isRelationKey(item)) return relationKeyOf(item);
  if ('name' in item && typeof item.name === 'string') return item.name;
  return JSON.stringify(item);
}

/** A relation, designed or scanned, or the key one is removed by. */
function isRelationKey(item: object): item is RelationKey {
  return (
    'kind' in item &&
    typeof item.kind === 'string' &&
    'from' in item &&
    typeof item.from === 'string'
  );
}
