export interface ChangeSetInput<Item, Key> {
  added?: Item[] | undefined;
  removed?: Key[] | undefined;
  modified?: Item[] | undefined;
}

export function findById<Item extends { id: string }>(
  set: ChangeSetInput<Item, string> | undefined,
  id: string,
): Item | null {
  const named = (item: Item) => item.id === id;
  return set?.added?.find(named) ?? set?.modified?.find(named) ?? null;
}

export function findByName<Item extends { name: string }>(
  set: ChangeSetInput<Item, string> | undefined,
  name: string,
): Item | null {
  const named = (item: Item) => item.name === name;
  return set?.added?.find(named) ?? set?.modified?.find(named) ?? null;
}
