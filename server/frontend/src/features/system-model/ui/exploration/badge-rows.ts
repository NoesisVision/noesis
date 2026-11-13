import { cardinalitySuffixOf } from '#/features/design-docs/cardinality.ts';
import type { Badge, SlotRelation } from '../../system-model-exploration.ts';

/*
 * A card's badges as it lays them out: a row for each relation it has a
 * slot of, inputs then output then state, each badge saying its slot as it
 * is written — `offer: Offer`, `products: DiscountedProduct [*]` — and, in
 * its tooltip, what it is to the card.
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

/** A badge's words: its slot as written, how many after the type when not exactly one. */
export const badgeLabelOf = ({ name, typeName, cardinality }: Badge) =>
  `${name}: ${typeName}${cardinalitySuffixOf(cardinality)}`;

/** What a badge is to its card, for its tooltip: `user: UserId · input 2`. */
export const badgeTipOf = (badge: Badge) =>
  `${badgeLabelOf(badge)} · ${
    badge.relation === 'input' && badge.position !== null
      ? `input ${badge.position}`
      : badge.relation
  }`;
