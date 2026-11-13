import { cardinalitySuffixOf } from '#/features/design-docs/cardinality.ts';
import type { Badge, SlotRelation } from '../../system-model-exploration.ts';

/*
 * A card's badges as it lays them out: a row for each relation it has a
 * slot of, inputs then output then state, each badge its slot's name over
 * its type — `offer` over `Offer`, `products` over `DiscountedProduct [*]`
 * — and, in its tooltip, the slot as written and what it is to the card.
 */

/** The order a card's rows read in, as a behavior's signature does. */
const ROW_ORDER: readonly SlotRelation[] = ['input', 'output', 'state'];

export interface BadgeRow {
  relation: SlotRelation;
  badges: readonly Badge[];
}

/** A card's badges in their rows; a relation with no slot has no row. */
export const badgeRowsOf = (badges: readonly Badge[]): BadgeRow[] =>
  ROW_ORDER.map((relation) => ({
    relation,
    badges: badges.filter((badge) => badge.relation === relation),
  })).filter(({ badges: row }) => row.length > 0);

/** A badge's type, how many after it when not exactly one: its second line. */
export const badgeTypeOf = ({ typeName, cardinality }: Badge) =>
  `${typeName}${cardinalitySuffixOf(cardinality)}`;

/** A badge's words: its slot as written, `name: Type [*]`. */
export const badgeLabelOf = (badge: Badge) =>
  `${badge.name}: ${badgeTypeOf(badge)}`;

/** What a badge is to its card, for its tooltip: `user: UserId · input 2`. */
export const badgeTipOf = (badge: Badge) =>
  `${badgeLabelOf(badge)} · ${
    badge.relation === 'input' && badge.position !== null
      ? `input ${badge.position}`
      : badge.relation
  }`;
