/** The word for a count: `rule` for one, `rules` for none or many. */
export const plural = (count: number, one: string, many = `${one}s`): string =>
  count === 1 ? one : many;

/** A count with its word: `1 rule`, `3 rules`. */
export const counted = (count: number, one: string, many?: string): string =>
  `${count} ${plural(count, one, many)}`;
