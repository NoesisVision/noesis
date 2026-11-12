/*
 * Lookups built from lists, typed as what they are, so no caller casts
 * `Object.fromEntries` back into a record.
 */

/** A record with a value for every key: `recordOf(['a', 'b'], f)` is `{ a: f('a'), b: f('b') }`. */
export function recordOf<Key extends string, Value>(
  keys: readonly Key[],
  valueOf: (key: Key) => Value,
): Record<Key, Value> {
  return Object.fromEntries(keys.map((key) => [key, valueOf(key)])) as Record<
    Key,
    Value
  >;
}

/** Each item by its id. */
export const byIdOf = <Item extends { id: string }>(
  items: readonly Item[],
): Map<string, Item> => new Map(items.map((item) => [item.id, item]));
