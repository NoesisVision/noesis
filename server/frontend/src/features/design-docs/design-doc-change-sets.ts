import { kindOf } from '#/shared/model/element-id.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { type DesignDocFieldInput } from './design-doc-field.ts';
import {
  COLLECTION_OF,
  type ContainedKind,
  isRelationPart,
  type OwnedPartKind,
  ownerRefOf,
  PART_SET,
  SET_OF,
  type Unit,
  type UnitRef,
  type UnitState,
} from './design-doc-unit.ts';
import { isRelation, relationKeyOf, relationKeyOfPart } from './relations.ts';

/*
 * Reading and writing a unit in its change set, wherever that set is in
 * the document: finding it, its state, and updating it in place.
 */

/** Whether an item of a change set is the unit: a relation by its key, anything else by its own. */
export function matchesRef(ref: UnitRef, item: unknown): boolean {
  if (isRelationPart(ref.kind) && 'owner' in ref)
    return (
      isRelation(item) &&
      relationKeyOf(item) === relationKeyOfPart(ref.kind, ref.owner.id, ref.id)
    );
  return keyOf(item) === ref.id;
}

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

export const isRemoved = (doc: DesignDocumentInput, id: string) =>
  topSetOf(doc, kindOf(id) as 'need' | ContainedKind).removed?.some(
    (key) => keyOf(key) === id,
  ) ?? false;

export const relationsOf = (doc: DesignDocumentInput) =>
  (doc.relations ?? {}) as LooseSet;

export interface LooseSet {
  added?: unknown[];
  modified?: unknown[];
  removed?: unknown[];
}

export type Container = Record<string, unknown>;

export interface RuleInput {
  id: string;
  needs?: DesignDocFieldInput<string[]>;
}

/** The key a change set knows an item by, as the server reads it. */
/** The key of everything a loose set names: added, modified and removed. */
export const keysOf = (set: LooseSet): string[] =>
  [...(set.added ?? []), ...(set.modified ?? []), ...(set.removed ?? [])].map(
    keyOf,
  );

export function keyOf(item: unknown): string {
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

/** The sets from the top of the document down to the unit's own, and the owners between them. */
function locationOf(ref: UnitRef): { sets: string[]; keys: string[] } {
  if (!('owner' in ref)) return { sets: [COLLECTION_OF[ref.kind]], keys: [] };
  if (isRelationPart(ref.kind)) return { sets: ['relations'], keys: [] };
  return { sets: [PART_SET[ref.kind as OwnedPartKind]], keys: [] };
}

export const topSetOf = (
  doc: DesignDocumentInput,
  kind: 'need' | ContainedKind,
) => (doc[SET_OF[kind]] ?? {}) as LooseSet;

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
export function updateAt<Doc extends DesignDocumentInput>(
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
