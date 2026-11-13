import { BUILDING_BLOCK_KINDS } from '#/shared/model/building-block-kinds.ts';
import { childIdOf, moduleOf, parentOf } from '#/shared/model/element-id.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import type {
  Cardinality,
  PrimitiveName,
  ScenarioStep,
} from '#backend/app/system-model/system-model.ts';
import {
  type Container,
  fieldOf,
  keyOf,
  unitStateOf,
} from './design-doc-change-sets.ts';
import { draftOf, type FieldDraft, fieldFrom } from './design-doc-field.ts';
import {
  isOwnedPart,
  isPart,
  isRelationPart,
  kindOfTarget,
  type OwnedPartKind,
  type PartOwner,
  type Unit,
  UNIT_LABEL,
  type UnitKind,
  type UnitState,
  type UnitTarget,
} from './design-doc-unit.ts';
import {
  OUTPUT_NAME,
  RELATION_KIND_OF,
  type RelationPartKind,
} from './relations.ts';

/*
 * A unit as the editor's form holds it — a draft of its fields — and the
 * unit a draft writes back.
 */

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

/** Whether a field may be changed: a key only while the design adds its part. */
export const isEditableField = (spec: FieldSpec, state: UnitState): boolean =>
  !spec.key || state === 'added';

/** Fields written in place, by name, each with its new value. */
export type InlineFields = Partial<UnitFieldValues>;

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

const keyValueOf = (unit: Unit, spec: FieldSpec): unknown =>
  spec.prop === '' ? unit : (unit as unknown as Container)[spec.prop];

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
