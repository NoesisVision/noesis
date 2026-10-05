import type { OutlineChange } from '#/features/design-docs/ui/model-tree/model-outline.ts';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';

/** The wire form of the server's widest change set: added, removed and modified. */
type WireChangeSet = NonNullable<DesignDocumentInput['buildingBlocks']>;

/**
 * What a design does to one collection, as the JSON form spells it: the
 * server's change set, its parts kept as the contract has them and filled
 * with the given items and keys. A set with no `modified` part, such as a
 * building block's `implements`, fits too.
 */
export type ChangeSetInput<Item, Key> = {
  [Part in keyof WireChangeSet]: Part extends 'removed'
    ? Key[] | undefined
    : Item[] | undefined;
};

/** Every item the design spells out: added, then modified. Removals are keys, not items. */
export const writtenIn = <Item>(
  set: ChangeSetInput<Item, unknown> | undefined,
): Item[] => [...(set?.added ?? []), ...(set?.modified ?? [])];

/** Every item the design spells out, with what it does to it. */
export function* named<Item>(
  set: ChangeSetInput<Item, unknown> | undefined,
): Generator<[Item, OutlineChange]> {
  for (const item of set?.added ?? []) yield [item, 'added'];
  for (const item of set?.modified ?? []) yield [item, 'modified'];
}

export function findById<Item extends { id: string }>(
  set: ChangeSetInput<Item, string> | undefined,
  id: string,
): Item | null {
  const matches = (item: Item) => item.id === id;
  return set?.added?.find(matches) ?? set?.modified?.find(matches) ?? null;
}

export function findByName<Item extends { name: string }>(
  set: ChangeSetInput<Item, string> | undefined,
  name: string,
): Item | null {
  const matches = (item: Item) => item.name === name;
  return set?.added?.find(matches) ?? set?.modified?.find(matches) ?? null;
}

/** What the design writes for an element that keeps rules: a building block, a behaviour or a module. */
export const designedOf = (doc: DesignDocumentInput, id: string) =>
  findById(doc.buildingBlocks, id) ??
  findById(doc.behaviours, id) ??
  findById(doc.modules, id);
