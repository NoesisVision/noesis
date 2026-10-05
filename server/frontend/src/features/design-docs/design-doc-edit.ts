import type {
  DesignDocumentInput,
  DesignDocViolation,
  DesignedBehaviourInput,
  DesignedBuildingBlockInput,
  DesignedDomainModuleInput,
  DesignedNeedInput,
  DesignedParameterInput,
  DesignedPropertyInput,
  DesignedResultInput,
  DesignedRuleInput,
  DesignedScenarioInput,
} from '#backend/app/design-docs/design-doc.ts';
import type {
  BehaviourType,
  BuildingBlockRefInput,
  BuildingBlockType,
  RuleCategory,
  RuleType,
  Visibility,
} from '#backend/app/system-model/system-model.ts';
import {
  type DesignDocFieldInput,
  draftOf,
  type FieldDraft,
  fieldFrom,
  refLabelOf,
  valueOf,
} from './design-doc-field.ts';
import {
  addressOf,
  childIdOf,
  isElementId,
  isWithin,
  nameOf,
  parentOf,
} from './element-id.ts';

/*
 * A human's revision of a design document, one unit at a time. An edit is an
 * operation rather than a new document, so it can be applied to the newest
 * version just before it is saved: the server replaces the document whole.
 *
 * Every unit lives in a change set somewhere in the document — a need or an
 * element at the top, a part inside the element that owns it, a rule's own
 * scenario inside that rule — and every operation is the same at any depth,
 * once it has found that set.
 */

export type ElementKind = 'module' | 'building_block' | 'behaviour';
export type PartKind =
  | 'rule'
  | 'scenario'
  | 'property'
  | 'parameter'
  | 'result'
  | 'implements';
export type UnitKind = 'need' | ElementKind | PartKind;

/** The element a part is written under, and the rule for a rule's own scenario. */
export interface PartOwner {
  kind: ElementKind;
  id: string;
  rule?: string;
}

/**
 * A unit by what it is and where it is. A part's `id` is the key its change
 * set knows it by: a name, a result's type, an implemented block's id.
 */
export type UnitRef =
  | { kind: 'need' | ElementKind; id: string }
  | { kind: PartKind; id: string; owner: PartOwner };

/** What the design does to a unit: its place in the unit's change set. */
export type UnitState = 'added' | 'modified' | 'removed' | 'unchanged';

interface UnitOf {
  need: DesignedNeedInput;
  module: DesignedDomainModuleInput;
  building_block: DesignedBuildingBlockInput;
  behaviour: DesignedBehaviourInput;
  rule: DesignedRuleInput;
  scenario: DesignedScenarioInput;
  property: DesignedPropertyInput;
  parameter: DesignedParameterInput;
  result: DesignedResultInput;
  implements: string;
}
export type Unit = UnitOf[UnitKind];

export const UNIT_LABEL: Record<UnitKind, string> = {
  need: 'need',
  module: 'module',
  building_block: 'building block',
  behaviour: 'behaviour',
  rule: 'rule',
  scenario: 'scenario',
  property: 'property',
  parameter: 'input',
  result: 'output',
  implements: 'implemented type',
};

const COLLECTION_OF = {
  need: 'needs',
  module: 'modules',
  building_block: 'buildingBlocks',
  behaviour: 'behaviours',
} as const satisfies Record<'need' | ElementKind, keyof DesignDocumentInput>;

const PART_SET: Record<PartKind, string> = {
  rule: 'rules',
  scenario: 'scenarios',
  property: 'properties',
  parameter: 'input',
  result: 'output',
  implements: 'implements',
};

const ELEMENT_KINDS = ['module', 'building_block', 'behaviour'] as const;

const isPart = (kind: UnitKind): kind is PartKind => kind in PART_SET;

/** Where a new unit goes, or the unit a form revises. */
export type UnitTarget =
  | { mode: 'add'; kind: 'need' | ElementKind; parent: string | null }
  | { mode: 'add'; kind: PartKind; owner: PartOwner }
  | { mode: 'edit'; ref: UnitRef };

export const kindOfTarget = (target: UnitTarget): UnitKind =>
  target.mode === 'add' ? target.kind : target.ref.kind;

/** The ref a target's unit has under a given id. */
export function refOfTarget(target: UnitTarget, id: string): UnitRef {
  if (target.mode === 'edit') return { ...target.ref, id } as UnitRef;
  return 'owner' in target
    ? { kind: target.kind, id, owner: target.owner }
    : { kind: target.kind, id };
}

/** The unit a part hangs under: its element, or the rule a scenario of a rule is in. */
function ownerRefOf(ref: UnitRef): UnitRef | null {
  if (!('owner' in ref)) return null;
  const { owner } = ref;
  const element = { kind: owner.kind, id: owner.id };
  return owner.rule === undefined
    ? element
    : { kind: 'rule', id: owner.rule, owner: element };
}

export type DesignDocEdit =
  | { op: 'add'; ref: UnitRef; unit: Unit }
  /** `unit` may carry another key than `ref`: an added unit renamed moves, an element with what is under it. */
  | { op: 'write'; ref: UnitRef; unit: Unit }
  | { op: Removal; ref: UnitRef }
  /** An element the design adds, under another parent — or, a module, at the top. */
  | { op: 'move'; ref: UnitRef; to: string | null };

/**
 * Taking a unit out, by what the design does to it: an added one is
 * discarded; a modified one is either left as the model has it or removed
 * from the system; a removed one is restored.
 */
export type Removal = 'discard' | 'removeFromSystem' | 'restore';

const REMOVALS: Record<UnitState, readonly Removal[]> = {
  added: ['discard'],
  modified: ['discard', 'removeFromSystem'],
  removed: ['restore'],
  unchanged: ['removeFromSystem'],
};

export const removalsOf = (state: UnitState): readonly Removal[] =>
  REMOVALS[state];

export function unitStateOf(doc: DesignDocumentInput, ref: UnitRef): UnitState {
  const set = setAt(doc, ref);
  if (set === null) return 'unchanged';
  const matches = (item: unknown) => keyOf(item) === ref.id;
  if (set.added?.some(matches)) return 'added';
  if (set.modified?.some(matches)) return 'modified';
  if (set.removed?.some(matches)) return 'removed';
  return 'unchanged';
}

/** Whether a unit may be written: not while it, or what it hangs under, is removed. */
export function isWritable(doc: DesignDocumentInput, ref: UnitRef): boolean {
  const owner = ownerRefOf(ref);
  return owner === null || unitStateOf(doc, owner) !== 'removed';
}

/** What the design writes for a unit; null for one it removes or leaves alone. */
export function unitOf(doc: DesignDocumentInput, ref: UnitRef): Unit | null {
  const set = setAt(doc, ref);
  const matches = (item: unknown) => keyOf(item) === ref.id;
  return (set?.added?.find(matches) ??
    set?.modified?.find(matches) ??
    null) as Unit | null;
}

/** A unit by the name a reader knows it by. */
export function unitNameOf(doc: DesignDocumentInput, ref: UnitRef): string {
  switch (ref.kind) {
    case 'need': {
      const need = unitOf(doc, ref);
      const name = need === null ? null : valueOf(fieldOf(need, 'name'));
      return typeof name === 'string' ? name : ref.id;
    }
    case 'module':
    case 'building_block':
    case 'behaviour':
    case 'implements':
      return nameOf(ref.id);
    case 'result':
      return refLabelOf(refOfKey(ref.id));
    default:
      return ref.id;
  }
}

/** The key a change set knows a result by: its type, as the server reads it. */
export const refKeyOf = (ref: BuildingBlockRefInput): string =>
  typeof ref === 'string' ? ref : JSON.stringify(ref);

const refOfKey = (key: string): BuildingBlockRefInput =>
  key.startsWith('{') ? (JSON.parse(key) as BuildingBlockRefInput) : key;

export function applyEdit<Doc extends DesignDocumentInput>(
  doc: Doc,
  edit: DesignDocEdit,
): Doc {
  const { ref } = edit;
  switch (edit.op) {
    case 'add':
      return updateAt(doc, ref, (set) => ({
        ...set,
        added: [...(set.added ?? []), edit.unit],
      }));
    case 'write':
      return written(doc, ref, edit.unit);
    case 'discard':
      return discarded(doc, ref);
    case 'removeFromSystem':
      return updateAt(
        withoutWithin(discarded(doc, ref), ref.id),
        ref,
        (set) => ({
          ...set,
          removed: [
            ...(set.removed ?? []),
            ref.kind === 'result' ? refOfKey(ref.id) : ref.id,
          ],
        }),
      );
    case 'move':
      return renamed(doc, ref.id, movedIdOf(ref, edit.to));
    case 'restore':
      return updateAt(doc, ref, (set) => ({
        ...set,
        removed: set.removed?.filter((key) => keyOf(key) !== ref.id),
      }));
  }
}

/** The names of the rules that answer a need, which lose it when it goes. */
export function rulesTracing(
  doc: DesignDocumentInput,
  needId: string,
): string[] {
  return elementsWithRules(doc).flatMap((element) =>
    [...(element.rules?.added ?? []), ...(element.rules?.modified ?? [])]
      .filter((rule) => (valueOf(rule.needs) ?? []).includes(needId))
      .map(({ name }) => name),
  );
}

/**
 * What the design writes under a unit, which goes with it: the elements under
 * an element, the scenarios of a rule.
 */
export function unitsWithin(doc: DesignDocumentInput, ref: UnitRef): number {
  if (ref.kind === 'rule') {
    const scenarios = (unitOf(doc, ref) as DesignedRuleInput | null)?.scenarios;
    return (
      (scenarios?.added?.length ?? 0) +
      (scenarios?.modified?.length ?? 0) +
      (scenarios?.removed?.length ?? 0)
    );
  }
  if (!isElementId(ref.id) || isPart(ref.kind)) return 0;
  return ELEMENT_KINDS.flatMap((kind) => {
    const set = topSetOf(doc, kind);
    return [
      ...(set.added ?? []).map(keyOf),
      ...(set.modified ?? []).map(keyOf),
      ...(set.removed ?? []).map(keyOf),
    ];
  }).filter((id) => id !== ref.id && isWithin(id, ref.id)).length;
}

/**
 * Whether an element may move: only one the design adds. One the model has
 * would have to be removed and added again, and the design does not hold
 * what the model says of it.
 */
export const canMove = (doc: DesignDocumentInput, ref: UnitRef): boolean =>
  (ref.kind === 'module' ||
    ref.kind === 'building_block' ||
    ref.kind === 'behaviour') &&
  unitStateOf(doc, ref) === 'added';

/** The id an element takes under another parent: its name stays, its place changes. */
export const movedIdOf = (ref: UnitRef, to: string | null): string =>
  childIdOf(ref.kind as ElementKind, to, nameOf(ref.id));

/**
 * Where an element may go: a module or a building block into any module the
 * design names or stands in, a module to the top as well, a behaviour into
 * any building block. Never into itself, nowhere the design removes, not
 * where it already is, and not where one of its name already stands.
 */
export function moveDestinationsOf(
  doc: DesignDocumentInput,
  ref: UnitRef,
): (string | null)[] {
  if (!canMove(doc, ref)) return [];
  const parentKind = ref.kind === 'behaviour' ? 'building_block' : 'module';
  const candidates: (string | null)[] = [
    ...(ref.kind === 'module' ? [null] : []),
    ...parentsNamedIn(doc, parentKind),
  ];
  const here = parentOf(ref.id);
  return candidates.filter(
    (to) =>
      to !== here &&
      (to === null || !isWithin(to, ref.id)) &&
      (to === null ||
        unitStateOf(doc, { kind: parentKind, id: to }) !== 'removed') &&
      unitStateOf(doc, {
        kind: ref.kind as ElementKind,
        id: movedIdOf(ref, to),
      }) === 'unchanged',
  );
}

/** Every module, or every building block, the document names or that holds something it names. */
function parentsNamedIn(
  doc: DesignDocumentInput,
  kind: 'module' | 'building_block',
): string[] {
  const found = new Set<string>();
  const prefix = kind === 'module' ? 'module|' : 'building_block|';
  const take = (id: string) => {
    for (let at: string | null = id; at !== null; at = parentOf(at))
      if (at.startsWith(prefix)) found.add(at);
  };
  for (const elementKind of ELEMENT_KINDS) {
    const set = topSetOf(doc, elementKind);
    for (const item of [
      ...(set.added ?? []),
      ...(set.modified ?? []),
      ...(set.removed ?? []),
    ])
      take(keyOf(item));
  }
  if (kind === 'building_block') blocksNamedIn(doc).forEach(take);
  return [...found].sort((a, b) => addressOf(a).localeCompare(addressOf(b)));
}

/** Every building block the document names anywhere, for a type to be chosen from. */
export function blocksNamedIn(doc: DesignDocumentInput): string[] {
  const found = new Set<string>();
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      if (node.startsWith('building_block|')) found.add(node);
    } else if (Array.isArray(node)) node.forEach(walk);
    else if (typeof node === 'object' && node !== null)
      Object.values(node).forEach(walk);
  };
  walk(doc);
  return [...found].sort((a, b) => addressOf(a).localeCompare(addressOf(b)));
}

// --- Drafts: a unit as its form holds it ---

interface UnitFieldValues {
  name: string;
  stakeholder: string;
  statement: string;
  definition: string;
  diagram: string;
  type: string;
  visibility: Visibility;
  category: string;
  ruleType: string;
  description: string;
  needs: string[];
  rationale: string;
  given: string;
  when: string;
  then: string;
  /** A type reference: a property's, an input's, an output's, a block implemented. */
  ref: BuildingBlockRefInput;
  optional: boolean;
}
export type UnitFieldName = keyof UnitFieldValues;

/**
 * A field a form shows, and the property of the unit it writes. A key is the
 * part's own name for itself — plain, not a field the design may leave alone
 * — and it changes only while the design adds the part.
 */
export interface FieldSpec {
  name: UnitFieldName;
  prop: string;
  key?: true;
}

const field = (name: UnitFieldName, prop: string = name): FieldSpec => ({
  name,
  prop,
});
const key = (name: UnitFieldName, prop: string = name): FieldSpec => ({
  name,
  prop,
  key: true,
});

const TYPED_PART = [
  key('name'),
  field('ref', 'type'),
  field('description'),
  field('optional'),
];

export const UNIT_FIELDS: Record<UnitKind, readonly FieldSpec[]> = {
  need: [field('name'), field('stakeholder'), field('statement')],
  module: [field('name'), field('definition'), field('diagram')],
  building_block: [
    field('name'),
    field('type'),
    field('definition'),
    field('diagram'),
  ],
  behaviour: [
    field('name'),
    field('type'),
    field('visibility'),
    field('definition'),
    field('diagram'),
  ],
  rule: [
    key('name'),
    field('category'),
    field('ruleType'),
    field('description'),
    field('needs'),
    field('rationale'),
  ],
  scenario: [
    key('name'),
    field('description'),
    field('given'),
    field('when'),
    field('then'),
  ],
  property: TYPED_PART,
  parameter: TYPED_PART,
  result: [key('ref', 'type'), field('description'), field('optional')],
  implements: [key('ref', '')],
};

/** The types an element may be, as the model spells them. */
export const TYPES_OF: Partial<Record<UnitKind, readonly string[]>> = {
  building_block: [
    'aggregate',
    'entity',
    'value_object',
    'domain_service',
    'application_service',
    'repository',
    'factory',
    'external_integration',
  ] satisfies BuildingBlockType[],
  behaviour: ['Command', 'Event', 'Query'] satisfies BehaviourType[],
};

/** The rule types each category allows, as the server's `RULE_TYPES_OF` has them. */
export const RULE_TYPES_OF: Record<RuleCategory, readonly RuleType[]> = {
  Business: ['Consistency', 'Structure', 'Computation', 'State change'],
  Quality: [
    'Performance',
    'Security',
    'Reliability',
    'Usability',
    'Compatibility',
    'Maintainability',
    'Portability',
  ],
  Constraint: ['Technology', 'Regulation', 'Interface', 'Organisation'],
};

export const PRIMITIVES = [
  'primitive|string',
  'primitive|integer',
  'primitive|decimal',
  'primitive|boolean',
  'primitive|date',
  'primitive|datetime',
  'primitive|duration',
  'primitive|uuid',
] as const;

/** What a new unit may leave out: the model never has them, so there is nothing to keep. */
const isOptionalField = (name: UnitFieldName): boolean =>
  name === 'diagram' || name === 'rationale';

const BLANK: UnitFieldValues = {
  name: '',
  stakeholder: '',
  statement: '',
  definition: '',
  diagram: '',
  type: '',
  visibility: { kind: 'private' },
  category: '',
  ruleType: '',
  description: '',
  needs: [],
  rationale: '',
  given: '',
  when: '',
  // The scenario's step, named as the contract names it.
  // oxlint-disable-next-line unicorn/no-thenable
  then: '', // NOSONAR
  ref: '',
  optional: false,
};

export interface UnitDraft {
  /** A need's id, which its writer chooses; anything else's follows from its fields. */
  id: string;
  fields: { [Field in UnitFieldName]?: FieldDraft<UnitFieldValues[Field]> };
}

/**
 * The form a unit opens in. A unit the model has may leave a field as the
 * model says it; a unit the design adds writes every field it shows, and a
 * blank optional one is dropped when it is saved.
 */
export function draftOfUnit(
  kind: UnitKind,
  unit: Unit | null,
  state: UnitState,
): UnitDraft {
  const added = state === 'added';
  const fields = Object.fromEntries(
    UNIT_FIELDS[kind].map((spec) => [
      spec.name,
      spec.key
        ? {
            written: true,
            value: unit === null ? BLANK[spec.name] : keyValueOf(unit, spec),
          }
        : draftOf(
            unit === null ? undefined : fieldOf(unit, spec.prop),
            BLANK[spec.name],
            added ? true : undefined,
          ),
    ]),
  );
  return { id: kind === 'need' ? (keyOf(unit) ?? '') : '', fields };
}

/** The id the draft gives its unit: an added element's moves with its name, a part's is its key. */
export function idOfDraft(
  doc: DesignDocumentInput,
  target: UnitTarget,
  draft: UnitDraft,
): string {
  const kind = kindOfTarget(target);
  const { name, ref } = draft.fields;
  if (isPart(kind)) {
    if (kind === 'result' || kind === 'implements')
      return refKeyOf(ref?.value ?? '');
    return name?.value.trim() ?? '';
  }
  if (kind === 'need')
    return target.mode === 'add' ? draft.id.trim() : target.ref.id;
  if (target.mode === 'add')
    return childIdOf(
      kind,
      'parent' in target ? target.parent : null,
      name?.value.trim() ?? '',
    );
  const current = target.ref;
  if (unitStateOf(doc, current) !== 'added' || !name?.written)
    return current.id;
  return childIdOf(kind, parentOf(current.id), name.value.trim());
}

/** The unit a draft writes, everything it does not edit — its rules, its scenarios — kept. */
export function unitFromDraft(
  kind: UnitKind,
  draft: UnitDraft,
  original: Unit | null,
  id: string,
): Unit {
  if (kind === 'implements') return id;
  const fields = Object.fromEntries(
    UNIT_FIELDS[kind].map((spec) => {
      const fieldDraft = trimmed<unknown>(draft.fields[spec.name]!);
      if (spec.key) return [spec.prop, fieldDraft.value];
      const blank =
        isOptionalField(spec.name) &&
        typeof fieldDraft.value === 'string' &&
        fieldDraft.value === '';
      return [
        spec.prop,
        fieldFrom<unknown>(
          blank ? { ...fieldDraft, written: false } : fieldDraft,
          original === null ? undefined : fieldOf(original, spec.prop),
        ),
      ];
    }),
  );
  const unit = { ...(original as object | null), ...fields };
  return (isPart(kind) ? unit : { ...unit, id }) as Unit;
}

/** Whether a field may be changed: a key only while the design adds its part. */
export const isEditableField = (spec: FieldSpec, state: UnitState): boolean =>
  !spec.key || state === 'added';

const NAME_SEPARATORS = /[.|]/;
const NEED_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** What the draft gets wrong before the server is asked, by form path. */
export function draftErrors(
  doc: DesignDocumentInput,
  target: UnitTarget,
  draft: UnitDraft,
): Record<string, string> {
  const kind = kindOfTarget(target);
  const errors: Record<string, string> = {};
  const { name, type, ref, category, ruleType } = draft.fields;
  if (name?.written) {
    if (name.value.trim() === '')
      errors['fields.name.value'] = 'A name is required.';
    else if (NAME_SEPARATORS.test(name.value))
      errors['fields.name.value'] = "A name cannot contain '.' or '|'.";
  }
  if (type?.written && type.value === '')
    errors['fields.type.value'] = 'Choose a type.';
  if (ref?.written && ref.value === '')
    errors['fields.ref.value'] = 'Choose a type.';
  if (category?.written && category.value === '')
    errors['fields.category.value'] = 'Choose a category.';
  if (ruleType?.written && ruleType.value === '')
    errors['fields.ruleType.value'] = 'Choose a rule type.';
  if (
    category?.written &&
    ruleType?.written &&
    category.value !== '' &&
    ruleType.value !== '' &&
    !RULE_TYPES_OF[category.value as RuleCategory].includes(
      ruleType.value as RuleType,
    )
  )
    errors['fields.ruleType.value'] =
      `A ${category.value} rule is one of: ${RULE_TYPES_OF[category.value as RuleCategory].join(', ')}.`;
  const owner =
    target.mode === 'add'
      ? 'owner' in target
        ? target.owner
        : null
      : 'owner' in target.ref
        ? target.ref.owner
        : null;
  if (
    kind === 'rule' &&
    owner?.kind === 'module' &&
    category?.written &&
    category.value === 'Business'
  )
    errors['fields.category.value'] = 'A module holds no business rules.';
  if (
    kind === 'need' &&
    target.mode === 'add' &&
    !NEED_ID.test(draft.id.trim())
  )
    errors.id = "Lower-case words joined by '-', e.g. 'start-a-refund'.";
  if (Object.keys(errors).length > 0) return errors;

  const id = idOfDraft(doc, target, draft);
  const unchangedId = target.mode === 'edit' && target.ref.id === id;
  if (
    !unchangedId &&
    unitStateOf(doc, refOfTarget(target, id)) !== 'unchanged'
  ) {
    const at =
      kind === 'need'
        ? 'id'
        : draft.fields.name
          ? 'fields.name.value'
          : 'fields.ref.value';
    errors[at] =
      `This design already has ${kind === 'need' ? 'a need with this id' : `this ${UNIT_LABEL[kind]} here`}.`;
  }
  return errors;
}

/** A need's id from its name, while its writer has not chosen one. */
export const needIdOf = (name: string): string =>
  name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 64);

// --- Violations: the server's answer, laid over the form ---

const VIOLATION_MESSAGE: Record<DesignDocViolation['reason'], string> = {
  changedInGreenField:
    'There is no scanned model yet, so nothing can be modified or removed.',
  unknownElement: 'The scanned model has no such element.',
  unchangedFieldInAddedItem: 'A new element has to say this.',
  humanAuthor: 'Only a human may write this field.',
  diagramInDefinition:
    'Draw the diagram in its own field, not in the definition.',
  unknownNeed: 'It answers a need this design does not state.',
  ruleTypeOutsideCategory: 'This rule type is not one of its category.',
  businessRuleOnModule: 'A module holds no business rules.',
};

export const violationsInWords = (
  violations: readonly DesignDocViolation[],
): string[] =>
  violations.map(
    ({ path, reason }) => `${VIOLATION_MESSAGE[reason]} (${path})`,
  );

/**
 * The violations on the unit's own fields, by form path, and the rest in
 * words. The path the server names a unit by runs through what it hangs
 * under, each as the saved document has it: an owner the design left alone
 * is modified once a part is written in it.
 */
export function violationsOf(
  doc: DesignDocumentInput,
  ref: UnitRef,
  state: UnitState,
  violations: readonly DesignDocViolation[],
): { fields: Record<string, string>; rest: string[] } {
  const prefix = `${serverPathOf(doc, ref, state)}.`;
  const specs = UNIT_FIELDS[ref.kind];
  const fields: Record<string, string> = {};
  const rest: string[] = [];
  for (const { path, reason } of violations) {
    const remainder = path.startsWith(prefix) ? path.slice(prefix.length) : '';
    const spec = specs.find(
      ({ prop }) =>
        prop !== '' && (remainder === prop || remainder.startsWith(`${prop}[`)),
    );
    if (spec !== undefined)
      fields[`fields.${spec.name}.value`] = VIOLATION_MESSAGE[reason];
    else rest.push(`${VIOLATION_MESSAGE[reason]} (${path})`);
  }
  return { fields, rest };
}

function serverPathOf(
  doc: DesignDocumentInput,
  ref: UnitRef,
  state: UnitState,
): string {
  const owner = ownerRefOf(ref);
  const at = `[${ref.id}]`;
  if (owner === null)
    return `${COLLECTION_OF[ref.kind as 'need' | ElementKind]}.${state}${at}`;
  const ownerState = unitStateOf(doc, owner);
  return `${serverPathOf(doc, owner, ownerState === 'unchanged' ? 'modified' : ownerState)}.${PART_SET[ref.kind as PartKind]}.${state}${at}`;
}

// --- The document's change sets, read loosely: every unit is known by its key ---

interface LooseSet {
  added?: unknown[];
  modified?: unknown[];
  removed?: unknown[];
}

type Container = Record<string, unknown>;

interface RuleInput {
  name: string;
  needs?: DesignDocFieldInput<string[]>;
}

interface ElementWithRules {
  id: string;
  rules?: { added?: RuleInput[]; modified?: RuleInput[]; removed?: string[] };
}

/** The key a change set knows an item by, as the server reads it. */
function keyOf(item: unknown): string {
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null) {
    if ('id' in item && typeof item.id === 'string') return item.id;
    if ('name' in item && typeof item.name === 'string') return item.name;
    if ('type' in item) return keyOf(item.type);
  }
  return JSON.stringify(item);
}

export const fieldOf = (
  unit: Unit,
  prop: string,
): DesignDocFieldInput<unknown> =>
  (unit as unknown as Record<string, DesignDocFieldInput<unknown>>)[prop];

const keyValueOf = (unit: Unit, spec: FieldSpec): unknown =>
  spec.prop === '' ? unit : (unit as unknown as Container)[spec.prop];

/** The sets from the top of the document down to the unit's own, and the owners between them. */
function locationOf(ref: UnitRef): { sets: string[]; keys: string[] } {
  if (!('owner' in ref)) return { sets: [COLLECTION_OF[ref.kind]], keys: [] };
  const { owner } = ref;
  return owner.rule === undefined
    ? {
        sets: [COLLECTION_OF[owner.kind], PART_SET[ref.kind]],
        keys: [owner.id],
      }
    : {
        sets: [COLLECTION_OF[owner.kind], 'rules', PART_SET[ref.kind]],
        keys: [owner.id, owner.rule],
      };
}

const topSetOf = (doc: DesignDocumentInput, kind: 'need' | ElementKind) =>
  (doc[COLLECTION_OF[kind]] ?? {}) as LooseSet;

/** The unit's change set; null while the design writes nothing of what it hangs under. */
function setAt(doc: DesignDocumentInput, ref: UnitRef): LooseSet | null {
  const { sets, keys } = locationOf(ref);
  let container: unknown = doc;
  for (const [index, owner] of keys.entries()) {
    const set = ((container as Container)[sets[index]!] ?? {}) as LooseSet;
    const matches = (item: unknown) => keyOf(item) === owner;
    container = set.added?.find(matches) ?? set.modified?.find(matches);
    if (container === undefined) return null;
  }
  return ((container as Container)[sets.at(-1)!] ?? {}) as LooseSet;
}

/**
 * The document with the unit's change set changed. An owner the design left
 * alone is written as a modification that changes nothing else, and one that
 * comes out changing nothing is dropped.
 */
function updateAt<Doc extends DesignDocumentInput>(
  doc: Doc,
  ref: UnitRef,
  change: (set: LooseSet) => LooseSet,
): Doc {
  const { sets, keys } = locationOf(ref);
  return updateIn(doc as Container, sets, keys, change) as Doc;
}

function updateIn(
  container: Container,
  sets: string[],
  keys: string[],
  change: (set: LooseSet) => LooseSet,
): Container {
  const [setName, ...innerSets] = sets as [string, ...string[]];
  const set = (container[setName] ?? {}) as LooseSet;
  if (keys.length === 0) return { ...container, [setName]: change(set) };
  const [owner, ...innerKeys] = keys as [string, ...string[]];
  const matches = (item: unknown) => keyOf(item) === owner;
  const inside = (item: unknown) =>
    updateIn(item as Container, innerSets, innerKeys, change);
  if (set.added?.some(matches))
    return {
      ...container,
      [setName]: {
        ...set,
        added: set.added.map((item) => (matches(item) ? inside(item) : item)),
      },
    };
  if (set.removed?.some(matches))
    throw new Error(
      `Nothing is written in ${owner}, which the design removes.`,
    );
  const current =
    set.modified?.find(matches) ??
    (setName === 'rules' ? { name: owner } : { id: owner });
  const updated = inside(current);
  const others = (set.modified ?? []).filter((item) => !matches(item));
  return {
    ...container,
    [setName]: {
      ...set,
      modified: changesNothing(updated) ? others : [...others, updated],
    },
  };
}

/** A modification that leaves every field as the model has it and changes nothing under it. */
function changesNothing(item: Container): boolean {
  return Object.entries(item).every(([prop, value]) => {
    if ((prop === 'id' || prop === 'name') && typeof value === 'string')
      return true;
    if (typeof value !== 'object' || value === null) return false;
    if ('changed' in value) return value.changed === false;
    return Object.values(value).every(
      (part) =>
        part === undefined || (Array.isArray(part) && part.length === 0),
    );
  });
}

function trimmed<T>(draft: FieldDraft<T>): FieldDraft<T> {
  return typeof draft.value === 'string'
    ? { ...draft, value: draft.value.trim() as T }
    : draft;
}

function written<Doc extends DesignDocumentInput>(
  doc: Doc,
  ref: UnitRef,
  unit: Unit,
): Doc {
  const state = unitStateOf(doc, ref);
  if (state === 'removed')
    throw new Error(
      `A removed ${UNIT_LABEL[ref.kind]} is restored before it is written: ${ref.id}`,
    );
  if (state === 'unchanged')
    return updateAt(doc, ref, (set) => ({
      ...set,
      modified: [...(set.modified ?? []), unit],
    }));
  const replaced = updateAt(doc, ref, (set) => ({
    ...set,
    [state]: (set[state] ?? []).map((item) =>
      keyOf(item) === ref.id ? unit : item,
    ),
  }));
  const id = keyOf(unit);
  return id === ref.id || isPart(ref.kind)
    ? replaced
    : renamed(replaced, ref.id, id);
}

function discarded<Doc extends DesignDocumentInput>(
  doc: Doc,
  ref: UnitRef,
): Doc {
  const state = unitStateOf(doc, ref);
  const dropped = updateAt(doc, ref, (set) => ({
    ...set,
    added: set.added?.filter((item) => keyOf(item) !== ref.id),
    modified: set.modified?.filter((item) => keyOf(item) !== ref.id),
  }));
  if (state !== 'added') return dropped;
  // Nothing the design added can stand under one it no longer adds, and no rule answers a need it no longer states.
  if (ref.kind === 'need') return untraced(dropped, ref.id);
  return isPart(ref.kind) ? dropped : withoutWithin(dropped, ref.id);
}

/** The document without the elements under `ancestor`, in any part of their change sets. */
function withoutWithin<Doc extends DesignDocumentInput>(
  doc: Doc,
  ancestor: string,
): Doc {
  if (!isElementId(ancestor)) return doc;
  const outside = (item: unknown) => {
    const id = keyOf(item);
    return id === ancestor || !isWithin(id, ancestor);
  };
  return ELEMENT_KINDS.reduce((next, kind) => {
    const set = topSetOf(next, kind);
    return {
      ...next,
      [COLLECTION_OF[kind]]: {
        ...set,
        added: set.added?.filter(outside),
        modified: set.modified?.filter(outside),
        removed: set.removed?.filter(outside),
      },
    };
  }, doc);
}

function untraced<Doc extends DesignDocumentInput>(
  doc: Doc,
  needId: string,
): Doc {
  const untrace = (rule: RuleInput): RuleInput => {
    const needs = valueOf(rule.needs);
    if (needs === null || !needs.includes(needId)) return rule;
    return {
      ...rule,
      needs: {
        changed: true,
        value: needs.filter((id) => id !== needId),
        author: 'human',
      },
    };
  };
  const withRules = (item: unknown): unknown => {
    const { rules } = item as ElementWithRules;
    if (rules === undefined) return item;
    return {
      ...(item as object),
      rules: {
        ...rules,
        added: rules.added?.map(untrace),
        modified: rules.modified?.map(untrace),
      },
    };
  };
  return ELEMENT_KINDS.reduce((next, kind) => {
    const set = topSetOf(next, kind);
    return {
      ...next,
      [COLLECTION_OF[kind]]: {
        ...set,
        added: set.added?.map(withRules),
        modified: set.modified?.map(withRules),
      },
    };
  }, doc);
}

function elementsWithRules(doc: DesignDocumentInput): ElementWithRules[] {
  return ELEMENT_KINDS.flatMap((kind) => {
    const set = topSetOf(doc, kind);
    return [
      ...(set.added ?? []),
      ...(set.modified ?? []),
    ] as ElementWithRules[];
  });
}

/**
 * The document with an element's id moved, and every id under it: wherever
 * the document names one — a key, an `implements`, a property's type.
 */
function renamed<Node>(node: Node, from: string, to: string): Node {
  if (typeof node === 'string') {
    if (!isElementId(node) || !isWithin(node, from)) return node;
    const kind = node.slice(0, node.indexOf('|') + 1);
    return `${kind}${addressOf(to)}${addressOf(node).slice(addressOf(from).length)}` as Node;
  }
  if (Array.isArray(node))
    return node.map((item: unknown) => renamed(item, from, to)) as Node;
  if (typeof node === 'object' && node !== null)
    return Object.fromEntries(
      Object.entries(node).map(([prop, value]) => [
        prop,
        renamed(value, from, to),
      ]),
    ) as Node;
  return node;
}
