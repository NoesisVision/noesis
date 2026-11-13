import { cardinalitySuffixOf } from '#/features/design-docs/cardinality.ts';
import { markWordOf } from '#/features/design-docs/element-reader.ts';
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
const badgeTypeOf = ({ typeName, cardinality }: Badge) =>
  `${typeName}${cardinalitySuffixOf(cardinality)}`;

/** A badge as it is said: `products: DiscountedProduct, many`. */
export const badgeSaidOf = (badge: Badge) => {
  const word = markWordOf(badge.cardinality);
  return `${badge.name}: ${badge.typeName}${word === null ? '' : `, ${word}`}`;
};

/** A badge's words, for its tooltip: its slot as written, `name: Type [*]`. */
const badgeLabelOf = (badge: Badge) => `${badge.name}: ${badgeTypeOf(badge)}`;

/** What a badge is to its card, for its tooltip: `user: UserId · input 2`. */
export const badgeTipOf = (badge: Badge) =>
  `${badgeLabelOf(badge)} · ${
    badge.relation === 'input' && badge.position !== null
      ? `input ${badge.position}`
      : badge.relation
  }`;

/** A card's badges as one flow of chips: inputs, then output, then state. */
export const chipsOf = (badges: readonly Badge[]): Badge[] =>
  badgeRowsOf(badges).flatMap(({ badges: row }) => row);

/*
 * A card's badges as its signature, the way the code declares it, without
 * the name its card already shows: `(offer: Offer, user: UserId) →
 * DiscountedOffer`, its output by type alone, then each field of its state,
 * `name: Type`, on a line of its own. The inputs go on one line while it
 * fits; past that, one to a line, and the output after the closing
 * bracket. The card's layout and its drawing both read the lines from
 * here, so they agree.
 */

/** A slot in a signature: named, `offer: Offer`, or an output, by its type alone. */
export interface SignatureSlot {
  badge: Badge;
  named: boolean;
}

/** A piece of a signature's line: its punctuation, or a slot. */
export type SignaturePart = string | SignatureSlot;

/** One character of a signature, in its monospace face (slot-badges.module.css). */
const SIGNATURE_CHAR = 7.3;
/**
 * The widest a signature's line runs before its inputs go one to a line:
 * the widest card a signature makes (layout-exploration.ts), less the
 * card's insets and the box round the lines.
 */
const SIGNATURE_ROOM = 370;

/** A slot in a signature, with the marks after its type. */
const signatureSlotWidthOf = ({ badge, named }: SignatureSlot) =>
  ((named ? badge.name.length + 2 : 0) + badge.typeName.length) *
    SIGNATURE_CHAR +
  (badge.cardinality === '1' ? 0 : 22) +
  (badge.onDiagram ? 13 : 0) +
  4;

/** A line's width: its punctuation in characters, its slots as drawn. */
export const signatureLineWidthOf = (line: readonly SignaturePart[]) =>
  Math.ceil(
    line.reduce(
      (all, part) =>
        all +
        (typeof part === 'string'
          ? part.length * SIGNATURE_CHAR
          : signatureSlotWidthOf(part)),
      0,
    ),
  );

export function signatureLinesOf(badges: readonly Badge[]): SignaturePart[][] {
  const of = (relation: SlotRelation) =>
    badges.filter((badge) => badge.relation === relation);
  const inputs = of('input').map((badge) => ({ badge, named: true }));
  const outputs: SignaturePart[] = of('output').flatMap((badge, at) => [
    ...(at === 0 ? [] : [', ']),
    { badge, named: false },
  ]);
  const gives: SignaturePart[] =
    outputs.length === 0 ? [')'] : [') → ', ...outputs];
  const lines: SignaturePart[][] = [];
  if (inputs.length + outputs.length > 0) {
    const one: SignaturePart[] = [
      '(',
      ...inputs.flatMap((slot, at) => (at === 0 ? [slot] : [', ', slot])),
      ...gives,
    ];
    if (signatureLineWidthOf(one) <= SIGNATURE_ROOM) lines.push(one);
    else
      lines.push(
        ['('],
        ...inputs.map((slot, at) =>
          at < inputs.length - 1 ? ['  ', slot, ','] : ['  ', slot],
        ),
        gives,
      );
  }
  for (const badge of of('state')) lines.push([{ badge, named: true }]);
  return lines;
}

/**
 * A chip: the relation's letter, `offer:` (an output by its type alone),
 * its type and the marks after it, each 5px from the last (the marks 3px),
 * within its padding and border.
 */
export const chipWidthOf = (badge: Badge) =>
  Math.ceil(
    18 +
      5 +
      (badge.relation === 'output' ? 0 : (badge.name.length + 1) * 6.4 + 5) +
      badge.typeName.length * 6.8 +
      (badge.cardinality === '1' ? 0 : 22) +
      (badge.onDiagram ? 13 : 0) +
      (badge.type.startsWith('primitive|') ? 0 : 13) +
      16 +
      // Slack, so a chip measured right to the pixel is not cut short.
      4,
  );
