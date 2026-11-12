import type { Cardinality } from '#backend/app/system-model/system-model.ts';

/*
 * How many values a slot holds, in every way the page says it: the choices a
 * select offers, the suffix a line of text writes after a type, and what
 * each means in words. The marks a panel draws for it are its UI
 * (`ui/element-details/cardinality-mark.tsx`).
 */

/** How many values a slot may hold, in the order a select offers them. */
export const CARDINALITIES = [
  '1',
  '0..1',
  '*',
] as const satisfies readonly Cardinality[];

/** How a cardinality reads after a type: nothing for exactly one, `[*]` or `[0..1]` otherwise. */
export const cardinalitySuffixOf = (cardinality: string | null): string =>
  cardinality === null || cardinality === '1' ? '' : ` [${cardinality}]`;

/** What each cardinality means, in words. */
const MEANING = {
  '1': 'exactly one',
  '0..1': 'one or none',
  '*': 'any number',
} as const satisfies Record<Cardinality, string>;

/** A cardinality as a select offers it: `[*] — any number`, `1 — exactly one`. */
export const cardinalityChoiceOf = (cardinality: Cardinality): string =>
  `${cardinalitySuffixOf(cardinality).trim() || cardinality} — ${MEANING[cardinality]}`;
