import {
  type Badge,
  type DrawnElement,
  type ExplorationGraph,
  inPlacingOrder,
  stepsBackFirst,
} from '../../system-model-exploration.ts';
import { signatureLinesOf, signatureLineWidthOf } from './badge-signature.ts';

/*
 * Where each element of the exploration stands when the diagram places it:
 * what a container holds is set out in rows, in the order of its kinds
 * (exploration-order.ts), the rows as long as make the whole nearest a
 * square, and the container sized around them. Positions are in the
 * canvas's own pixels, a contained element's relative to its container, as
 * React Flow reads them. The relations do not shape where the cards go;
 * the edges are drawn between the cards wherever they then stand.
 */

export interface Placement {
  /** Containers before what they hold, as React Flow needs a parent first. */
  elements: PlacedElement[];
}

export interface PlacedElement {
  element: DrawnElement;
  /** Whether other elements are drawn inside it. */
  holds: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A card's height, whatever its name: its name and what it is. The way to
 * what it contains sits on its border, so it needs no room of its own.
 */
export const HEIGHT = 56;
/** Wide enough for a short name beside the card's menu and cross. */
const MIN_WIDTH = 180;
const MAX_WIDTH = 300;
/** About one character of the card's name, with its icon, its padding and the dots and cross beside it. */
export const widthOf = (name: string) =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, name.length * 7.5 + 116));

/*
 * From further off, with the behaviors in frames out of sight, a name is
 * drawn larger, and the same size on every card and frame
 * (exploration.module.css), so each is at least as wide as its name then
 * takes — close up too, as nothing is placed anew on the way.
 */
/** How many times its own size a name is drawn at from further off. */
export const FAR_NAME_SCALE = 2;
/** Round a card's name from further off: the card's padding, a pill's the most. */
const FAR_CARD_INSET = 44;
/** Round a frame's name from further off, in its top or its middle. */
const FAR_FRAME_INSET = 24;
/** A frame's name is a button: its padding, either side. */
const FRAME_LABEL_PADDING = 16;

/** About one letter of a name, as wide as the diagram's type draws it. */
const letterWidthOf = (letter: string) => {
  if (/[MWmw]/.test(letter)) return 13.5;
  if (/[Iijlftr .]/.test(letter)) return 5.2;
  return /[A-Z]/.test(letter) ? 10 : 8.6;
};

/** About what a name takes at its own size, with the icon of its kind before it. */
export const nameWidthOf = (name: string) => {
  let width = 22;
  for (const letter of name) width += letterWidthOf(letter);
  return Math.ceil(width);
};

/** A card's least width: its name close up and, unless it is out of sight by then, from further off. */
const cardWidthOf = (element: DrawnElement) =>
  Math.max(
    widthOf(element.name),
    stepsBackFirst(element)
      ? 0
      : FAR_CARD_INSET + nameWidthOf(element.name) * FAR_NAME_SCALE,
  );

/**
 * A frame's least width: its name, inset in the frame, and its menu and the
 * way off the diagram beside it; or its name alone from further off.
 */
const frameWidthOf = (name: string) =>
  Math.max(
    widthOf(name) + 32,
    FAR_FRAME_INSET +
      (nameWidthOf(name) + FRAME_LABEL_PADDING) * FAR_NAME_SCALE,
  );

/**
 * Room at the top of a container for its name, and round what it holds;
 * at the bottom enough that the plus on a card's border there and the one
 * on the container's own stand apart.
 */
export interface Padding {
  top: number;
  left: number;
  bottom: number;
  right: number;
}
export const PADDING: Readonly<Padding> = {
  top: 60,
  left: 16,
  bottom: 40,
  right: 16,
};

/*
 * A card that carries badges (slot-badges.module.css): its name and what it
 * is at the top, then its signature in a box, a line of it to a line. The
 * sizes here are what the stylesheet draws, so the layout leaves each card
 * the room it needs.
 */
/** Where a card's badges start, below its name and what it is. */
const BADGES_TOP = 50;
/** Where a frame's badges start, below its name. */
const FRAME_BADGES_TOP = 52;
/** Room under a card's badges, clear of its rounded corners. */
const BADGES_BOTTOM = 10;
/** Room either side of the badges, inside the card. */
const BADGES_INSET = 16;
/** One line of a signature. */
export const SIGNATURE_LINE = 20;
/** A signature's box round its lines: padding and border, each side. */
const SIGNATURE_BOX = 9;
/** The widest a card grows for its signature; a line past it is cut short. */
const MAX_BADGED_WIDTH = 420;
const NO_BADGES: readonly Badge[] = [];

/** What the sizes of a card's badges are read from, and whether it stands without what holds it. */
type Carrying = Pick<ExplorationGraph, 'badges'> &
  Partial<Pick<ExplorationGraph, 'noOutput' | 'parentless'>>;

/** The way to a card's parent, beside its menu and cross: a third button, and its gap. */
const PARENT_ROOM = 24;
const parentRoomOf = (element: DrawnElement, { parentless }: Carrying) =>
  parentless?.has(element.id) === true ? PARENT_ROOM : 0;

/**
 * The room a card's badges take, under a name needing `least` across: how
 * wide the card is, and how tall its signature.
 */
function badgeBlockOf(
  element: DrawnElement,
  least: number,
  { badges, noOutput }: Carrying,
): { width: number; height: number } {
  const lines = signatureLinesOf(
    badges.get(element.id) ?? NO_BADGES,
    noOutput?.has(element.id),
  );
  if (lines.length === 0) return { width: least, height: 0 };
  return {
    width: Math.max(
      least,
      Math.min(
        MAX_BADGED_WIDTH,
        2 * BADGES_INSET +
          2 * SIGNATURE_BOX +
          Math.max(...lines.map(signatureLineWidthOf)),
      ),
    ),
    height: lines.length * SIGNATURE_LINE + 2 * SIGNATURE_BOX,
  };
}

/** A card's size: its name and what it is, and room for its badges under them. */
export function cardSizeOf(element: DrawnElement, carrying: Carrying) {
  const { width, height } = badgeBlockOf(
    element,
    cardWidthOf(element) + parentRoomOf(element, carrying),
    carrying,
  );
  if (height === 0) return { width, height: HEIGHT };
  return { width, height: BADGES_TOP + height + BADGES_BOTTOM };
}

/** A frame's least width: its name, and its longest row of badges. */
export const frameLeastWidthOf = (element: DrawnElement, carrying: Carrying) =>
  badgeBlockOf(
    element,
    frameWidthOf(element.name) + parentRoomOf(element, carrying),
    carrying,
  ).width;

/** A frame's room round what it holds: at the top, its name and its badges. */
export function paddingOf(
  element: DrawnElement,
  carrying: Carrying,
): Readonly<Padding> {
  const { height } = badgeBlockOf(
    element,
    frameWidthOf(element.name),
    carrying,
  );
  if (height === 0) return PADDING;
  return {
    ...PADDING,
    top: FRAME_BADGES_TOP + height + BADGES_BOTTOM,
  };
}

/**
 * The room between two cards side by side, and between two rows of them:
 * wide enough for the edges that run between them to be told apart. A card
 * placed beside another, or moved off one, keeps the same room
 * (place-locally.ts, canvas-workspace.ts).
 */
export const SPACING = 96;

/** A box to be set out: a card, or a frame with all it holds. */
interface Box {
  width: number;
  height: number;
}

/** What is round the boxes set out: a frame's padding, and its least width. */
interface Round {
  across: number;
  down: number;
  least: number;
}
const NOTHING_ROUND: Round = { across: 0, down: 0, least: 0 };

/** The boxes in rows no longer than `limit`, in their order, and the next limit that would set them out otherwise. */
function rowsWithin(boxes: readonly Box[], limit: number) {
  const at: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let tallest = 0;
  let width = 0;
  let next = Infinity;
  for (const box of boxes) {
    if (x > 0 && x + box.width > limit) {
      // Long enough for this box, the row would have taken it.
      next = Math.min(next, x + box.width);
      y += tallest + SPACING;
      x = 0;
      tallest = 0;
    }
    at.push({ x, y });
    x += box.width + SPACING;
    tallest = Math.max(tallest, box.height);
    width = Math.max(width, x - SPACING);
  }
  return { at, width, height: y + tallest, next };
}

/**
 * Boxes set out in rows, in their order, each row from the left and the
 * rows one under another: with rows of the length that makes the whole —
 * what is round them counted — fit the smallest square, and of those the
 * one that takes least room. Rows are tried from the shortest, a box to a
 * row, each a little longer than the last, until the whole is wider than
 * it is tall: longer still would only be wider.
 */
export function setOutInSquare(
  boxes: readonly Box[],
  round: Round = NOTHING_ROUND,
) {
  let limit = Math.max(0, ...boxes.map(({ width }) => width));
  let best: ReturnType<typeof rowsWithin> | null = null;
  let bestSide = Infinity;
  let bestRoom = Infinity;
  for (;;) {
    const rows = rowsWithin(boxes, limit);
    const width = Math.max(round.least, rows.width + round.across);
    const height = rows.height + round.down;
    const side = Math.max(width, height);
    if (side < bestSide || (side === bestSide && width * height < bestRoom)) {
      best = rows;
      bestSide = side;
      bestRoom = width * height;
    }
    if (rows.next === Infinity || width >= height) return best ?? rows;
    limit = rows.next;
  }
}

/**
 * Places what is drawn inside `within` — the whole diagram, or one frame's
 * own elements with all they hold: each container's elements in the order
 * of their kinds, set out in a square, the container sized around them.
 * Its own elements are placed from the corner of what they cover.
 */
export function layoutExploration(
  graph: ExplorationGraph,
  within: string | null = null,
): Placement {
  const children = new Map<string | null, DrawnElement[]>();
  for (const element of graph.elements)
    children.set(element.parent, [
      ...(children.get(element.parent) ?? []),
      element,
    ]);

  /** What a container holds, placed inside its padding, each before what it holds itself. */
  const setOut = (
    parent: string | null,
    corner: Readonly<Padding>,
    round: Round,
  ) => {
    const kids = inPlacingOrder(children.get(parent) ?? []);
    const sized = kids.map(sizeOf);
    const rows = setOutInSquare(sized, round);
    return {
      width: rows.width,
      height: rows.height,
      placed: kids.flatMap((element, at): PlacedElement[] => {
        const { width, height, holds, inside } = sized[at]!;
        const spot = rows.at[at]!;
        return [
          {
            element,
            holds,
            x: corner.left + spot.x,
            y: corner.top + spot.y,
            width,
            height,
          },
          ...inside,
        ];
      }),
    };
  };

  /** A card's size, or a frame's round all it holds, with those placed inside it. */
  const sizeOf = (
    element: DrawnElement,
  ): Box & { holds: boolean; inside: PlacedElement[] } => {
    if ((children.get(element.id) ?? []).length === 0)
      return { ...cardSizeOf(element, graph), holds: false, inside: [] };
    const padding = paddingOf(element, graph);
    const across = padding.left + padding.right;
    const down = padding.top + padding.bottom;
    const least = frameLeastWidthOf(element, graph);
    const held = setOut(element.id, padding, { across, down, least });
    return {
      width: Math.max(least, held.width + across),
      height: Math.max(HEIGHT, held.height + down),
      holds: true,
      inside: held.placed,
    };
  };

  return { elements: setOut(within, NO_PADDING, NOTHING_ROUND).placed };
}

const NO_PADDING: Readonly<Padding> = { top: 0, left: 0, bottom: 0, right: 0 };

/**
 * What one container holds, placed as though nothing else were drawn: its
 * own elements from the corner of its room for them, anything they hold
 * inside them.
 */
export const layoutWithin = (
  graph: ExplorationGraph,
  id: string,
): PlacedElement[] => layoutExploration(graph, id).elements;
