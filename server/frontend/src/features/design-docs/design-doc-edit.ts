import { BUILDING_BLOCK_KINDS } from '#/shared/model/building-block-kinds.ts';
import {
  addressOf,
  childIdOf,
  idPrefixOf,
  isBuildingBlock,
  isElementId,
  isWithin,
  kindOf,
  moduleOf,
  nameOf,
  parentOf,
  prefixOf,
} from '#/shared/model/element-id.ts';
import { kindInProseOf } from '#/shared/model/element-words.ts';
import type {
  DesignDocumentInput,
  DesignDocViolation,
  DesignedActorInput,
  DesignedBehaviorInput,
  DesignedBuildingBlockInput,
  DesignedDomainModuleInput,
  DesignedManualProcessInput,
  DesignedNeedInput,
  DesignedRelationKeyInput,
  DesignedRuleInput,
  DesignedScenarioInput,
} from '#backend/app/design-docs/design-doc.ts';
import type {
  Cardinality,
  PrimitiveName,
  RuleKind,
  ScenarioStep,
} from '#backend/app/system-model/system-model.ts';
import { writtenIn } from './change-set.ts';
import {
  type DesignDocFieldInput,
  draftOf,
  type FieldDraft,
  fieldFrom,
  valueOf,
} from './design-doc-field.ts';
import {
  CONTAINING_RELATION,
  CONTAINMENT_KINDS,
  type DesignedExtendsInput,
  type DesignedInputInput,
  type DesignedOutputInput,
  type DesignedStateInput,
  GOVERNING_KINDS,
  isRelation,
  OUTPUT_NAME,
  RELATION_KIND_OF,
  type RelationLike,
  type RelationPartKind,
  relationKeyOf,
  relationKeyOfPart,
  relationsFrom,
  typeOf,
} from './relations.ts';
import { rulesUnder } from './rules.ts';

/*
 * A human's revision of a design document, one unit at a time. An edit is an
 * operation rather than a new document, so it can be applied to the newest
 * version just before it is saved: the server replaces the document whole.
 *
 * Every unit lives in a change set somewhere in the document — a need, an
 * element, a rule or a scenario at the top, and a property, an input, an
 * output or an extended type among the relations, from the element that
 * owns it — and every operation is the same wherever it is, once it has
 * found that set. A rule is written under the behavior that governs it and
 * a scenario under its rule: adding one writes the `behavior_governs_rule`
 * or `illustrates` relation that joins them.
 */

export type ElementKind = 'module' | 'building_block' | 'behavior';
/** Who drives the system and the work they do: elements of no module. */
type PeopleKind = 'actor' | 'manual_process';
type OwnedPartKind = 'rule' | 'scenario';
type PartKind = OwnedPartKind | RelationPartKind;
export type UnitKind = 'need' | ElementKind | PeopleKind | PartKind;

/** The element a part is written under — a rule's behavior — and the rule for a scenario. */
export interface PartOwner {
  kind: ElementKind;
  id: string;
  rule?: string;
}

/**
 * A unit by what it is and where it is. A part's `id` is the key its change
 * set knows it by: a rule's or a scenario's id, a name — an output's is
 * always `result` — or an extended type's id.
 */
export type UnitRef =
  | { kind: 'need' | ElementKind | PeopleKind; id: string }
  | { kind: PartKind; id: string; owner: PartOwner };

/** What the design does to a unit: its place in the unit's change set. */
export type UnitState = 'added' | 'modified' | 'removed' | 'unchanged';

interface UnitOf {
  need: DesignedNeedInput;
  module: DesignedDomainModuleInput;
  building_block: DesignedBuildingBlockInput;
  behavior: DesignedBehaviorInput;
  actor: DesignedActorInput;
  manual_process: DesignedManualProcessInput;
  rule: DesignedRuleInput;
  scenario: DesignedScenarioInput;
  property: DesignedStateInput;
  parameter: DesignedInputInput;
  result: DesignedOutputInput;
  extends: DesignedExtendsInput;
}
export type Unit = UnitOf[UnitKind];

export const UNIT_LABEL: Record<UnitKind, string> = {
  need: kindInProseOf('need'),
  module: kindInProseOf('module'),
  building_block: kindInProseOf('building_block'),
  behavior: kindInProseOf('behavior'),
  actor: kindInProseOf('actor'),
  manual_process: kindInProseOf('manual_process'),
  rule: kindInProseOf('rule'),
  scenario: kindInProseOf('scenario'),
  property: 'property',
  parameter: 'input',
  result: 'output',
  extends: 'extended type',
};

const COLLECTION_OF = {
  need: 'needs',
  module: 'modules',
  building_block: 'buildingBlocks',
  behavior: 'behaviors',
  actor: 'actors',
  manual_process: 'manualProcesses',
} as const satisfies Record<
  'need' | ElementKind | PeopleKind,
  keyof DesignDocumentInput
>;

const PART_SET: Record<OwnedPartKind, string> = {
  rule: 'rules',
  scenario: 'scenarios',
};

const ELEMENT_KINDS = ['module', 'building_block', 'behavior'] as const;

const isRelationPart = (kind: UnitKind): kind is RelationPartKind =>
  kind in RELATION_KIND_OF;
/** A part with an id of its own, which its name gives it: a rule, a scenario. */
const isOwnedPart = (kind: UnitKind): kind is OwnedPartKind => kind in PART_SET;
const isPart = (kind: UnitKind): kind is PartKind =>
  kind in PART_SET || isRelationPart(kind);

/** Whether an item of a change set is the unit: a relation by its key, anything else by its own. */
function matchesRef(ref: UnitRef, item: unknown): boolean {
  if (isRelationPart(ref.kind) && 'owner' in ref)
    return (
      isRelation(item) &&
      relationKeyOf(item) === relationKeyOfPart(ref.kind, ref.owner.id, ref.id)
    );
  return keyOf(item) === ref.id;
}

/** Where a new unit goes, or the unit a form revises. */
export type UnitTarget =
  | {
      mode: 'add';
      kind: 'need' | ElementKind | PeopleKind;
      parent: string | null;
    }
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
  /** `first`: ahead of what the design already adds, the newest on top. */
  | { op: 'add'; ref: UnitRef; unit: Unit; first?: boolean }
  /** `unit` may carry another key than `ref`: an added unit renamed moves, an element with what is under it. */
  | { op: 'write'; ref: UnitRef; unit: Unit }
  /** `type`: a slot's type as the model has it, for a slot whose type the design leaves unsaid. */
  | { op: Removal; ref: UnitRef; type?: string }
  /** An element the design adds, under another parent — or, a module, at the top. */
  | { op: 'move'; ref: UnitRef; to: string | null }
  /** A part the design adds, written into another owner — a scenario into another rule. */
  | { op: 'relocate'; from: UnitRef; ref: UnitRef; unit: Unit };

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
  const matches = (item: unknown) => matchesRef(ref, item);
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
  const matches = (item: unknown) => matchesRef(ref, item);
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
    case 'rule':
    case 'scenario': {
      const unit = unitOf(doc, ref);
      const name = unit === null ? null : valueOf(fieldOf(unit, 'name'));
      return typeof name === 'string' ? name : nameOf(ref.id);
    }
    case 'module':
    case 'building_block':
    case 'behavior':
    case 'actor':
    case 'manual_process':
    case 'extends':
      return nameOf(ref.id);
    case 'result': {
      const output = unitOf(doc, ref);
      const type = output === null ? null : typeOf(output as RelationLike);
      return type === null ? ref.id : nameOf(type);
    }
    default:
      return ref.id;
  }
}

export function applyEdit<Doc extends DesignDocumentInput>(
  doc: Doc,
  edit: DesignDocEdit,
): Doc {
  const { ref } = edit;
  switch (edit.op) {
    case 'add': {
      const unit = placed(doc, ref, edit.unit);
      const added = updateAt(doc, ref, (set) => ({
        ...set,
        added: edit.first
          ? [unit, ...(set.added ?? [])]
          : [...(set.added ?? []), unit],
      }));
      return isElement(ref.kind)
        ? contained(added, ref.id, 'added')
        : joined(added, ref);
    }
    case 'write':
      return written(doc, ref, edit.unit);
    case 'discard':
      return discarded(doc, ref);
    case 'removeFromSystem': {
      const key = removalKeyOf(doc, ref, edit.type);
      const dropped = discarded(doc, ref);
      const removed = updateAt(
        isPart(ref.kind) ? dropped : withoutWithin(dropped, ref.id),
        ref,
        (set) => ({ ...set, removed: [...(set.removed ?? []), key] }),
      );
      return isElement(ref.kind)
        ? contained(removed, ref.id, 'removed')
        : removed;
    }
    case 'move': {
      const to = movedIdOf(ref, edit.to);
      return contained(
        renamed(uncontained(doc, ref.id, 'added'), ref.id, to),
        to,
        'added',
      );
    }
    case 'relocate':
      return joined(
        updateAt(discarded(doc, edit.from), ref, (set) => ({
          ...set,
          added: [...(set.added ?? []), edit.unit],
        })),
        ref,
      );
    case 'restore': {
      const restored = updateAt(doc, ref, (set) => ({
        ...set,
        removed: set.removed?.filter((key) => !matchesRef(ref, key)),
      }));
      return isElement(ref.kind)
        ? uncontained(restored, ref.id, 'removed')
        : restored;
    }
  }
}

const isElement = (kind: UnitKind): kind is ElementKind =>
  (ELEMENT_KINDS as readonly UnitKind[]).includes(kind);

/** The relation by which an element's parent contains it, by the element's kind. */

/**
 * The document with the relation that places `id` under its parent among
 * those it adds or removes. A root module is under nothing, and a parent the
 * design removes takes what is under it along.
 */
function contained<Doc extends DesignDocumentInput>(
  doc: Doc,
  id: string,
  part: 'added' | 'removed',
): Doc {
  const parent = parentOf(id);
  if (parent === null || isRemoved(doc, parent)) return doc;
  const relation = {
    kind: CONTAINING_RELATION[kindOf(id) as ElementKind],
    from: parent,
    to: id,
  };
  const relations = relationsOf(doc);
  const key = relationKeyOf(relation);
  if (relations[part]?.some((item) => keyOf(item) === key)) return doc;
  return {
    ...doc,
    relations: { ...relations, [part]: [...(relations[part] ?? []), relation] },
  };
}

/** The document without the relation that places `id` under its parent, among those it adds or removes. */
function uncontained<Doc extends DesignDocumentInput>(
  doc: Doc,
  id: string,
  part: 'added' | 'removed',
): Doc {
  const relations = relationsOf(doc);
  return {
    ...doc,
    relations: {
      ...relations,
      [part]: relations[part]?.filter(
        (item) =>
          !isRelation(item) ||
          !CONTAINMENT_KINDS.has(item.kind) ||
          item.to !== id,
      ),
    },
  };
}

const isRemoved = (doc: DesignDocumentInput, id: string) =>
  topSetOf(doc, kindOf(id) as 'need' | ContainedKind).removed?.some(
    (key) => keyOf(key) === id,
  ) ?? false;

const relationsOf = (doc: DesignDocumentInput) =>
  (doc.relations ?? {}) as LooseSet;

/**
 * What a removal from the system writes for a unit: a relation's key — a
 * named slot's with the type the model has, which the edit carries, or else
 * the one the design gives it — and anything else's id or name.
 */
function removalKeyOf(
  doc: DesignDocumentInput,
  ref: UnitRef,
  type: string | undefined,
): unknown {
  if (!isRelationPart(ref.kind) || !('owner' in ref)) return ref.id;
  const from = ref.owner.id;
  if (ref.kind === 'extends')
    return { kind: RELATION_KIND_OF.extends, from, to: ref.id };
  const unit = unitOf(doc, ref);
  const to = type ?? (unit === null ? null : typeOf(unit as RelationLike));
  if (to === null)
    throw new Error(
      `The type of ${ref.id} is not known, so it cannot be removed.`,
    );
  return {
    kind: RELATION_KIND_OF[ref.kind],
    from,
    to,
    name: ref.id,
  } as DesignedRelationKeyInput;
}

/**
 * A rule or a scenario added is joined to what it is shown under: a rule
 * governed by its behavior, a scenario illustrating its rule.
 */
function joined<Doc extends DesignDocumentInput>(doc: Doc, ref: UnitRef): Doc {
  if (!('owner' in ref) || !isOwnedPart(ref.kind)) return doc;
  const { owner } = ref;
  const relation =
    ref.kind === 'rule'
      ? owner.kind === 'behavior'
        ? { kind: 'behavior_governs_rule', from: owner.id, to: ref.id }
        : null
      : owner.rule === undefined
        ? null
        : { kind: 'illustrates', from: ref.id, to: owner.rule };
  if (relation === null) return doc;
  const relations = (doc.relations ?? {}) as LooseSet;
  const key = relationKeyOf(relation as RelationLike);
  if ((relations.added ?? []).some((item) => keyOf(item) === key)) return doc;
  return {
    ...doc,
    relations: { ...relations, added: [...(relations.added ?? []), relation] },
  };
}

/** The names of the rules that answer a need, which lose it when it goes. */
export function rulesTracing(
  doc: DesignDocumentInput,
  needId: string,
): string[] {
  return writtenIn(doc.rules)
    .filter((rule) => (valueOf(rule.needs) ?? []).includes(needId))
    .map((rule) => valueOf(rule.name) ?? nameOf(rule.id));
}

/**
 * What the design writes under a unit, which goes with it: the elements under
 * an element, the scenarios of a rule.
 */
export function unitsWithin(doc: DesignDocumentInput, ref: UnitRef): number {
  if (!isElementId(ref.id) || (isPart(ref.kind) && ref.kind !== 'rule'))
    return 0;
  return CONTAINED_KINDS.flatMap((kind) => {
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
    ref.kind === 'behavior') &&
  unitStateOf(doc, ref) === 'added';

/** The id an element takes under another parent: its name stays, its place changes. */
export const movedIdOf = (ref: UnitRef, to: string | null): string =>
  childIdOf(ref.kind as ElementKind, to, nameOf(ref.id));

/**
 * Where an element may go: a module or a building block into any module the
 * design names or stands in, a module to the top as well, a behavior into
 * any building block. Never into itself, nowhere the design removes, not
 * where it already is, and not where one of its name already stands.
 */
export function moveDestinationsOf(
  doc: DesignDocumentInput,
  ref: UnitRef,
): (string | null)[] {
  if (!canMove(doc, ref)) return [];
  const parentKind = ref.kind === 'behavior' ? 'building_block' : 'module';
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
  const prefix = prefixOf(kind);
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
      if (isBuildingBlock(node)) found.add(node);
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
  /** A rule's kind. */
  kind: string;
  description: string;
  needs: string[];
  rationale: string;
  /** A scenario's steps, in the order they are read. */
  steps: ScenarioStep[];
  /** A slot's type — a property's, an input's, an output's — or a block extended. */
  ref: string;
  /** How many values a property, an input or an output holds. */
  cardinality: Cardinality | '';
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

const NAMED_SLOT = [key('name'), field('ref', 'to'), field('cardinality')];

export const UNIT_FIELDS: Record<UnitKind, readonly FieldSpec[]> = {
  need: [field('name'), field('stakeholder'), field('statement')],
  module: [field('name'), field('definition'), field('diagram')],
  building_block: [
    field('name'),
    field('type'),
    field('definition'),
    field('diagram'),
  ],
  behavior: [field('name'), field('definition'), field('diagram')],
  actor: [field('name'), field('definition')],
  manual_process: [field('name'), field('definition')],
  rule: [
    field('name'),
    field('kind'),
    field('description'),
    field('needs'),
    field('rationale'),
  ],
  scenario: [field('name'), field('description'), field('steps')],
  property: NAMED_SLOT,
  parameter: NAMED_SLOT,
  result: [field('ref', 'to'), field('cardinality')],
  extends: [key('ref', 'to')],
};

/** The types an element may be, as the model spells them. */
export const TYPES_OF: Partial<Record<UnitKind, readonly string[]>> = {
  building_block: BUILDING_BLOCK_KINDS,
};

/** The kinds a rule may be, as the model spells them. */
export const RULE_KINDS = [
  'validation',
  'state_change',
  'post',
  'computation',
  'coordination',
  'configuration',
] as const satisfies readonly RuleKind[];

export const PRIMITIVES = [
  'primitive|string',
  'primitive|integer',
  'primitive|decimal',
  'primitive|boolean',
  'primitive|date',
  'primitive|datetime',
  'primitive|duration',
  'primitive|uuid',
] as const satisfies readonly `primitive|${PrimitiveName}`[];

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
  kind: '',
  description: '',
  needs: [],
  rationale: '',
  // A new scenario starts as the classic three, each to be written or removed.
  steps: [
    { kind: 'given', text: '' },
    { kind: 'when', text: '' },
    { kind: 'then', text: '' },
  ],
  ref: '',
  cardinality: '1',
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
  if (isOwnedPart(kind)) return ownedIdOf(doc, target, kind, name);
  if (isPart(kind)) {
    if (kind === 'result') return OUTPUT_NAME;
    if (kind === 'extends') return ref?.value ?? '';
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

/**
 * A rule's id is its name under the module of the behavior that governs it,
 * a scenario's its name under its rule; it moves with the name while the
 * design adds the unit.
 */
function ownedIdOf(
  doc: DesignDocumentInput,
  target: UnitTarget,
  kind: OwnedPartKind,
  name: FieldDraft<string> | undefined,
): string {
  const written = name?.value.trim() ?? '';
  if (target.mode === 'add') {
    const owner = 'owner' in target ? target.owner : null;
    const parent =
      owner === null
        ? null
        : kind === 'rule'
          ? moduleOf(owner.id)
          : (owner.rule ?? null);
    return childIdOf(kind, parent, written);
  }
  const current = target.ref;
  if (unitStateOf(doc, current) !== 'added' || !name?.written)
    return current.id;
  return childIdOf(kind, parentOf(current.id), written);
}

/**
 * The unit a draft writes, everything it does not edit kept. A relation part is written from the element that owns
 * it, which the draft does not hold.
 */
export function unitFromDraft(
  kind: UnitKind,
  draft: UnitDraft,
  original: Unit | null,
  id: string,
  owner: PartOwner | null = null,
): Unit {
  if (isRelationPart(kind)) {
    if (owner === null)
      throw new Error(`A ${UNIT_LABEL[kind]} is written from its element.`);
    return relationFromDraft(kind, draft, original, id, owner);
  }
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
  return (isPart(kind) && !isOwnedPart(kind) ? unit : { ...unit, id }) as Unit;
}

function relationFromDraft(
  kind: RelationPartKind,
  draft: UnitDraft,
  original: Unit | null,
  id: string,
  owner: PartOwner,
): Unit {
  const relation = { kind: RELATION_KIND_OF[kind], from: owner.id };
  if (kind === 'extends') return { ...relation, to: id } as Unit;
  const written = (name: UnitFieldName, prop: string) =>
    fieldFrom<unknown>(
      trimmed<unknown>(draft.fields[name]!),
      original === null ? undefined : fieldOf(original, prop),
    );
  const slot = {
    ...relation,
    name: id,
    to: written('ref', 'to'),
    cardinality: written('cardinality', 'cardinality'),
  };
  // A parameter keeps the place it has; a new one is placed when it is added.
  return (
    kind === 'parameter' && original !== null
      ? { ...slot, position: fieldOf(original, 'position') }
      : slot
  ) as Unit;
}

/**
 * A parameter added takes the place after the last the design gives the
 * behavior. The design does not see the scanned parameters, so one added
 * to a scanned behavior may share a place with one of theirs; they then
 * read in the order they stand.
 */
function placed(doc: DesignDocumentInput, ref: UnitRef, unit: Unit): Unit {
  if (ref.kind !== 'parameter' || !('owner' in ref)) return unit;
  if ('position' in (unit as object)) return unit;
  const taken = writtenIn(relationsFrom(doc, 'parameter', ref.owner.id))
    .map(({ position }) => valueOf(position))
    .filter((position): position is number => typeof position === 'number');
  return {
    ...unit,
    position: {
      changed: true,
      value: Math.max(0, ...taken) + 1,
      author: 'human',
    },
  } as Unit;
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
  const { name, type, ref, steps } = draft.fields;
  const ruleKind = draft.fields.kind;
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
  if (
    draft.fields.cardinality?.written &&
    draft.fields.cardinality.value === ''
  )
    errors['fields.cardinality.value'] = 'Choose how many it holds.';
  if (ruleKind?.written && ruleKind.value === '')
    errors['fields.kind.value'] = 'Choose a kind.';
  if (steps?.written) {
    if (steps.value.length === 0)
      errors['fields.steps.value'] = 'A scenario needs at least one step.';
    steps.value.forEach((step, index) => {
      if (step.text.trim() === '')
        errors[`fields.steps.value.${index}.text`] =
          'Write this step, or remove it.';
    });
  }
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

/**
 * A rule to write in place: added under a behavior, which governs it, with a
 * name no rule of its module has, and nothing said of it yet.
 */
export function newRuleOf(
  doc: DesignDocumentInput,
  owner: PartOwner,
  named?: string,
): DesignDocEdit {
  const idOf = (name: string) => childIdOf('rule', moduleOf(owner.id), name);
  const taken = (name: string) =>
    unitStateOf(doc, { kind: 'rule', id: idOf(name), owner }) !== 'unchanged';
  let name = named ?? 'New rule';
  if (named === undefined)
    for (let n = 2; taken(name); n += 1) name = `New rule ${n}`;
  const written = <T>(value: T) => ({
    changed: true as const,
    value,
    author: 'human' as const,
  });
  const id = idOf(name);
  return {
    op: 'add',
    first: true,
    ref: { kind: 'rule', id, owner },
    unit: {
      id,
      name: written(name),
      kind: written('validation'),
      description: written(''),
      needs: written([]),
    },
  };
}

/** The ids of the rules the design shows under an element: added, then modified. */
export const rulesOf = (doc: DesignDocumentInput, owner: PartOwner): string[] =>
  writtenIn(rulesUnder(doc, owner.id)).map(({ id }) => id);

/** Fields written in place, by name, each with its new value. */
export type InlineFields = Partial<UnitFieldValues>;

/**
 * One unit with some of its fields written in place, as a human, the rest
 * as the design has them: the edit that saves it, and the id the unit has
 * after it — an added element renamed moves — or what is wrong with it.
 */
export function inlineEditOf(
  doc: DesignDocumentInput,
  ref: UnitRef,
  fields: InlineFields,
): { edit: DesignDocEdit; id: string } | { error: string } {
  const state = unitStateOf(doc, ref);
  const original = unitOf(doc, ref);
  const draft = draftOfUnit(ref.kind, original, state);
  for (const [name, value] of Object.entries(fields))
    (draft.fields as Record<string, FieldDraft<unknown>>)[name] = {
      written: true,
      value,
    };
  const target: UnitTarget = { mode: 'edit', ref };
  const [error] = Object.values(draftErrors(doc, target, draft));
  if (error !== undefined) return { error };
  const id = idOfDraft(doc, target, draft);
  return {
    edit: {
      op: 'write',
      ref,
      unit: unitFromDraft(
        ref.kind,
        draft,
        original,
        id,
        'owner' in ref ? ref.owner : null,
      ),
    },
    id,
  };
}

/** A need's id from its name, while its writer has not chosen one. */
export const needIdOf = (name: string): string =>
  name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    // Runs are one dash by now: at most one to drop at either end.
    .replace(/^-/, '')
    .replace(/-$/, '')
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
  ungovernedRule: 'A rule needs a behavior that follows it.',
  uncontained:
    'The design does not add the relation that places this element under the one it is in.',
  unknownRelationEnd:
    'Neither this design nor the scanned model has this element.',
  containmentOutsideIdPath:
    'What holds what is in the ids: a module contains only what its id names under it, a scenario illustrates only the rule its id names.',
};

export const violationsInWords = (
  violations: readonly DesignDocViolation[],
): string[] =>
  violations.map(
    ({ path, reason }) => `${VIOLATION_MESSAGE[reason]} (${path})`,
  );

/**
 * The violations on the unit's own fields, by form path, and the rest in
 * words, by the path the server names the unit by.
 */
export function violationsOf(
  ref: UnitRef,
  state: UnitState,
  violations: readonly DesignDocViolation[],
): { fields: Record<string, string>; rest: string[] } {
  const prefix = `${serverPathOf(ref, state)}.`;
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

function serverPathOf(ref: UnitRef, state: UnitState): string {
  if (isRelationPart(ref.kind) && 'owner' in ref)
    return `relations.${state}[${relationKeyOfPart(ref.kind, ref.owner.id, ref.id)}]`;
  const at = `[${ref.id}]`;
  if (isOwnedPart(ref.kind)) return `${PART_SET[ref.kind]}.${state}${at}`;
  return `${COLLECTION_OF[ref.kind as 'need' | ElementKind | PeopleKind]}.${state}${at}`;
}

// --- The document's change sets, read loosely: every unit is known by its key ---

interface LooseSet {
  added?: unknown[];
  modified?: unknown[];
  removed?: unknown[];
}

type Container = Record<string, unknown>;

interface RuleInput {
  id: string;
  needs?: DesignDocFieldInput<string[]>;
}

/** The key a change set knows an item by, as the server reads it. */
function keyOf(item: unknown): string {
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null) {
    if ('id' in item && typeof item.id === 'string') return item.id;
    if (isRelation(item)) return relationKeyOf(item);
    if ('name' in item && typeof item.name === 'string') return item.name;
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
  if (isRelationPart(ref.kind)) return { sets: ['relations'], keys: [] };
  return { sets: [PART_SET[ref.kind as OwnedPartKind]], keys: [] };
}

/** The kinds an element's id holds the ids of, at the top of the document. */
const CONTAINED_KINDS = [...ELEMENT_KINDS, 'rule', 'scenario'] as const;
type ContainedKind = (typeof CONTAINED_KINDS)[number];

const SET_OF: Record<'need' | ContainedKind, keyof DesignDocumentInput> = {
  ...COLLECTION_OF,
  rule: 'rules',
  scenario: 'scenarios',
};

const topSetOf = (doc: DesignDocumentInput, kind: 'need' | ContainedKind) =>
  (doc[SET_OF[kind]] ?? {}) as LooseSet;

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
  const current = set.modified?.find(matches) ?? { id: owner };
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
  if (typeof draft.value === 'string')
    return { ...draft, value: draft.value.trim() as T };
  if (isSteps(draft.value))
    return {
      ...draft,
      value: draft.value.map((step) => ({
        ...step,
        text: step.text.trim(),
      })) as T,
    };
  return draft;
}

const isSteps = (value: unknown): value is ScenarioStep[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      'kind' in item &&
      'text' in item,
  );

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
      matchesRef(ref, item) ? unit : item,
    ),
  }));
  const id = keyOf(unit);
  return id === ref.id || (isPart(ref.kind) && !isOwnedPart(ref.kind))
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
    added: set.added?.filter((item) => !matchesRef(ref, item)),
    modified: set.modified?.filter((item) => !matchesRef(ref, item)),
  }));
  if (state !== 'added') return dropped;
  // Nothing the design added can stand under one it no longer adds, no rule
  // answers a need it no longer states, and none stays that no behavior
  // the design adds follows.
  if (ref.kind === 'need') return untraced(dropped, ref.id);
  if (isPart(ref.kind) && !isOwnedPart(ref.kind)) return dropped;
  return withoutUngoverned(
    uncontained(withoutWithin(dropped, ref.id), ref.id, 'added'),
  );
}

/**
 * The document without the elements under `ancestor`, in any part of their
 * change sets, and without the relations from them or ending at them, the
 * ancestor's own included: a relation stands on both its ends. A slot typed
 * by one of them stays, for its holder to be retyped.
 */
function withoutWithin<Doc extends DesignDocumentInput>(
  doc: Doc,
  ancestor: string,
): Doc {
  if (!isElementId(ancestor)) return doc;
  const outside = (item: unknown) => {
    const id = keyOf(item);
    return id === ancestor || !isWithin(id, ancestor);
  };
  const apart = (item: unknown) =>
    !isRelation(item) ||
    (!isWithin(item.from, ancestor) &&
      !(typeof item.to === 'string' && isWithin(item.to, ancestor)));
  const relations = relationsOf(doc);
  const kept = {
    ...doc,
    relations: {
      ...relations,
      added: relations.added?.filter(apart),
      modified: relations.modified?.filter(apart),
      removed: relations.removed?.filter(apart),
    },
  };
  return CONTAINED_KINDS.reduce((next, kind) => {
    const set = topSetOf(next, kind);
    return {
      ...next,
      [SET_OF[kind]]: {
        ...set,
        added: set.added?.filter(outside),
        modified: set.modified?.filter(outside),
        removed: set.removed?.filter(outside),
      },
    };
  }, kept);
}

/** The document without the rules it adds that no behavior or manual process it adds governs any longer. */
function withoutUngoverned<Doc extends DesignDocumentInput>(doc: Doc): Doc {
  const governed = new Set(
    ((doc.relations ?? {}) as LooseSet).added
      ?.filter(isRelation)
      .flatMap((relation) =>
        GOVERNING_KINDS.has(relation.kind) && typeof relation.to === 'string'
          ? [relation.to]
          : [],
      ),
  );
  const lost = (topSetOf(doc, 'rule').added ?? [])
    .map(keyOf)
    .filter((id) => !governed.has(id));
  return lost.reduce((next, id) => withoutWithin(next, id), doc);
}

function untraced<Doc extends DesignDocumentInput>(
  doc: Doc,
  needId: string,
): Doc {
  const untrace = (item: unknown): unknown => {
    const rule = item as RuleInput;
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
  const set = topSetOf(doc, 'rule');
  return {
    ...doc,
    rules: {
      ...set,
      added: set.added?.map(untrace),
      modified: set.modified?.map(untrace),
    },
  };
}

/**
 * The document with an element's id moved, and every id under it: wherever
 * the document names one — a key, a relation's end, a slot's type.
 */
function renamed<Node>(node: Node, from: string, to: string): Node {
  if (typeof node === 'string') {
    if (!isElementId(node) || !isWithin(node, from)) return node;
    const kind = idPrefixOf(node);
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
