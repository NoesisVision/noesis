import type { Rect } from './geometry.ts';

/**
 * What a canvas holds after a card is clicked: taken in hand alone; clicked
 * again, alone in hand, let go of. With Ctrl or Cmd (`adding`) it joins the
 * hand, or leaves it.
 */
export const selectionAfterClick = (
  held: readonly string[],
  id: string,
  adding: boolean,
): readonly string[] =>
  !adding
    ? held.length === 1 && held[0] === id
      ? []
      : [id]
    : held.includes(id)
      ? held.filter((each) => each !== id)
      : [...held, id];

/** A card on the canvas, as a box drawn over it reads it. */
export interface BoxedCard {
  id: string;
  /** Where it stands and how large, in the pixels the box is given in. */
  rect: Rect;
  /** A frame, drawn round other cards. */
  holds: boolean;
}

const touches = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

const takesIn = (box: Rect, rect: Rect) =>
  rect.x >= box.x &&
  rect.y >= box.y &&
  rect.x + rect.width <= box.x + box.width &&
  rect.y + rect.height <= box.y + box.height;

/**
 * What a box drawn on the canvas takes in hand: each card and each frame it
 * touches, however little of it. The one frame left out is a frame the box
 * is drawn inside, whole: that is where the box is, not what it is drawn
 * over.
 */
export const selectionInBox = (
  box: Rect,
  cards: readonly BoxedCard[],
): string[] =>
  cards
    .filter(
      ({ rect, holds }) => touches(box, rect) && !(holds && takesIn(rect, box)),
    )
    .map(({ id }) => id);
