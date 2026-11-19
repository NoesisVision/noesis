import { type ExploredElement, groupOf } from './exploration.model.ts';

/*
 * The order the diagram sets its elements out in when it places them for
 * the reader, by what each is. Said here, once: every placing reads it.
 */

/** Every type the order does not name. */
const REST = 'rest';

/**
 * What goes before what, by an element's group — `module`, or a building
 * block's type (`groupOf`): the modules first, then the services and the
 * factories that do the work, then all else, and the value objects last.
 */
export const PLACING_ORDER = [
  'module',
  'domain_service',
  'application_service',
  'factory',
  REST,
  'value_object',
] as const;

const RANK = new Map<string, number>(
  PLACING_ORDER.map((group, at) => [group, at]),
);
const REST_RANK = PLACING_ORDER.indexOf(REST);

/** Where an element stands in the order. */
const placingRankOf = (element: ExploredElement): number =>
  RANK.get(groupOf(element)) ?? REST_RANK;

/** The elements in the order they are set out in; those of one rank keep the order they came in. */
export const inPlacingOrder = <Element extends ExploredElement>(
  elements: readonly Element[],
): Element[] =>
  elements.toSorted((a, b) => placingRankOf(a) - placingRankOf(b));
