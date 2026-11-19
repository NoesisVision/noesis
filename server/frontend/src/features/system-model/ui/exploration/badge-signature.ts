import { markWordOf } from '#/features/design-docs/element-reader.ts';
import type { Badge, SlotRelation } from '../../system-model-exploration.ts';

/*
 * A card's badges as it writes them: its signature, each slot a badge in
 * it, and what each badge says of itself when read out.
 */

/** A badge as it is said: `products: DiscountedProduct, many`. */
export const badgeSaidOf = (badge: Badge) => {
  const word = markWordOf(badge.cardinality);
  return `${badge.name}: ${badge.typeName}${word === null ? '' : `, ${word}`}`;
};

/*
 * A card's badges as its signature, the way the code declares it, without
 * the name its card already shows: `(offer: Offer, user: UserId) →
 * DiscountedOffer`, its output by type alone, then each field of its state,
 * `name: Type`, on a line of its own. The inputs go on one line while it
 * fits; past that, one to a line, and the output after the closing
 * bracket. A behavior that gives nothing back says so where its output
 * would be: `(offer: Offer) → void`. The card's layout and its drawing both
 * read the lines from here, so they agree.
 */

/** A slot in a signature: named, `offer: Offer`, or an output, by its type alone. */
interface SignatureSlot {
  badge: Badge;
  named: boolean;
}

/** Where a behavior's output would be written, when it gives nothing back. */
export const NO_OUTPUT = Symbol('no output');

/** A piece of a signature's line: its punctuation, a slot, or the mark of no output. */
export type SignaturePart = string | SignatureSlot | typeof NO_OUTPUT;

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

/** The mark of no output: `void`, and the room either side of it. */
const NO_OUTPUT_WIDTH = 'void'.length * SIGNATURE_CHAR + 4;

const signaturePartWidthOf = (part: SignaturePart) => {
  if (part === NO_OUTPUT) return NO_OUTPUT_WIDTH;
  return typeof part === 'string'
    ? part.length * SIGNATURE_CHAR
    : signatureSlotWidthOf(part);
};

/** A line's width: its punctuation in characters, its slots and marks as drawn. */
export const signatureLineWidthOf = (line: readonly SignaturePart[]) =>
  Math.ceil(line.reduce((all, part) => all + signaturePartWidthOf(part), 0));

export function signatureLinesOf(
  badges: readonly Badge[],
  /** A behavior that gives nothing back, to say so after its inputs. */
  noOutput = false,
): SignaturePart[][] {
  const of = (relation: SlotRelation) =>
    badges.filter((badge) => badge.relation === relation);
  const inputs = of('input').map((badge) => ({ badge, named: true }));
  const outputs: SignaturePart[] = of('output').flatMap((badge, at) => [
    ...(at === 0 ? [] : [', ']),
    { badge, named: false },
  ]);
  const given: SignaturePart[] = noOutput ? [NO_OUTPUT] : outputs;
  const gives: SignaturePart[] =
    given.length === 0 ? [')'] : [') → ', ...given];
  const lines: SignaturePart[][] = [];
  if (inputs.length + given.length > 0) {
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
