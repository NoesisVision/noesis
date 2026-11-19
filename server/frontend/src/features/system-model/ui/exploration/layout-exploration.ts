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
 * what a container holds is set out in order — of its kinds
 * (exploration-order.ts), or the one that tangles its edges least
 * (layout-by-relations.ts) — each as high up and then as far left as it
 * can stand, as wide in all as makes the whole nearest a square, and the
 * container sized around them. Positions are in the
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

/**
 * The boxes set out no wider than `limit`, in their order, in rows: each
 * row from the left, its boxes level at the top, the next row under the
 * tallest of them. A row with a tall box in it would leave the room under
 * its short ones empty, so the box that comes next is tucked in there
 * instead — under a shorter one, as high as it can stand — when it fits
 * wholly within the row's height; and so the ones after it, beside or
 * under it, until one does not fit and starts the next row. Read from the
 * top, each row from the left and what is tucked into it after, the boxes
 * are in the order they came in. With it, the next width that would set
 * them out otherwise.
 */
function packedWithin(boxes: readonly Box[], limit: number) {
  // The line under which everything so far stands, its room round it
  // counted, from the left: each stretch of it, and how far down it is.
  let line = [{ from: 0, to: Infinity, down: 0 }];
  const at: { x: number; y: number }[] = [];
  let width = 0;
  let height = 0;
  let next = Infinity;
  // The row being filled: where it starts, where its next box goes, how
  // far down its tallest box reaches, and everything tucked into it.
  let row = { top: 0, along: 0, bottom: 0, under: 0 };
  let last: { x: number; y: number } | null = null;
  for (const box of boxes) {
    let spot: { x: number; y: number } | null = null;
    // In the row, level with the rest — until something is tucked under
    // it, which the page reads after it.
    if (last === null || last.y === row.top) {
      if (row.along === 0 || row.along + box.width <= limit)
        spot = { x: row.along, y: row.top };
      // Wide enough for this box, the row would have taken it.
      else next = Math.min(next, row.along + box.width);
    }
    // Else tucked into the row: under a shorter box, where it is clear and
    // fits within the row's height, and comes after the last one as read.
    if (spot === null && last !== null)
      for (const { from: x } of line) {
        if (x + box.width > limit) continue;
        let clear = 0;
        for (const { from, to, down } of line)
          if (from < x + box.width + SPACING && to > x)
            clear = Math.max(clear, down);
        const y: number = x > last.x ? Math.max(clear, last.y) : clear;
        const after = y > last.y || (y === last.y && x > last.x);
        if (
          y > row.top &&
          after &&
          y + box.height <= row.bottom &&
          (spot === null || y < spot.y)
        )
          spot = { x, y };
      }
    // Else it starts the next row, under all of this one.
    if (spot === null) {
      row = { top: row.under + SPACING, along: 0, bottom: 0, under: 0 };
      spot = { x: 0, y: row.top };
    }
    at.push(spot);
    last = spot;
    const under = spot.y + box.height;
    if (spot.y === row.top) {
      row.along = spot.x + box.width + SPACING;
      row.bottom = Math.max(row.bottom, under);
    }
    row.under = Math.max(row.under, under);
    width = Math.max(width, spot.x + box.width);
    height = Math.max(height, under);
    // The line now runs under the box, and the room round it.
    const from = spot.x;
    const to = from + box.width + SPACING;
    line = [
      ...line.flatMap((stretch) => [
        ...(stretch.from < from
          ? [{ ...stretch, to: Math.min(stretch.to, from) }]
          : []),
        ...(stretch.to > to
          ? [{ ...stretch, from: Math.max(stretch.from, to) }]
          : []),
      ]),
      { from, to, down: under + SPACING },
    ].toSorted((a, b) => a.from - b.from);
  }
  return { at, width, height, next };
}

/**
 * How much larger round a container may be for its elements to stay where
 * they stood: a quarter more, at most.
 */
const STAYING_SLACK = 1.25;

/** How many times as wide as it is tall a setting out may be before wider ones are no longer tried. */
const WIDE_ENOUGH = 2;

/** How much larger round one setting out may be than the smallest and still count as small as it: then the squarer is taken. */
const AS_SMALL = 1.05;

/**
 * Boxes set out in their order (`packedWithin`), as wide as makes the
 * whole — what is round them counted — the smallest round: its width and
 * its height together, which a box with room left empty in it adds to.
 * Of those within a twentieth of the smallest, the squarest. Widths are
 * tried from the narrowest, a box across, each a little wider than the
 * last, until the whole is twice as wide as tall.
 *
 * Told how many boxes each setting out would move from where they stood
 * (`movedOf`), it keeps to the one that moves fewest, while that is no
 * more than a quarter larger round: adding one box does not send every
 * other somewhere else.
 */
export function setOutInSquare(
  boxes: readonly Box[],
  round: Round = NOTHING_ROUND,
  movedOf?: (at: readonly { x: number; y: number }[]) => number,
) {
  let limit = Math.max(0, ...boxes.map(({ width }) => width));
  const tried: {
    rows: ReturnType<typeof packedWithin>;
    /** Its width and its height together. */
    around: number;
    /** Its longer side: the square it fits. */
    side: number;
    room: number;
  }[] = [];
  for (;;) {
    const rows = packedWithin(boxes, limit);
    const width = Math.max(round.least, rows.width + round.across);
    const height = rows.height + round.down;
    tried.push({
      rows,
      around: width + height,
      side: Math.max(width, height),
      room: width * height,
    });
    // By the boxes' own width: a frame wider than they need is no reason
    // to stop short of the width that would fill it.
    const across = rows.width + round.across;
    if (rows.next === Infinity || across >= height * WIDE_ENOUGH) break;
    limit = rows.next;
  }
  const least = Math.min(...tried.map(({ around }) => around));
  const best = (a: (typeof tried)[number], b: (typeof tried)[number]) => {
    const [small, alsoSmall] = [a, b].map(
      ({ around }) => around <= least * AS_SMALL,
    );
    if (small !== alsoSmall) return small ? -1 : 1;
    return small
      ? a.side - b.side || a.room - b.room
      : a.around - b.around || a.room - b.room;
  };
  if (movedOf === undefined) return tried.toSorted(best)[0]!.rows;
  return tried
    .filter(({ around }) => around <= least * STAYING_SLACK)
    .map((each) => ({ ...each, moved: movedOf(each.rows.at) }))
    .toSorted((a, b) => a.moved - b.moved || best(a, b))[0]!.rows;
}

/**
 * Where each element stood before a placing, relative to its container: a
 * new placing keeps to it where it can (see `setOutInSquare`, and
 * layout-by-relations.ts).
 */
export type Stood = ReadonlyMap<string, { x: number; y: number }>;

/** How far off where it stood an element may be placed and still be where it was. */
const STAYS_WITHIN = 0.5;

/** Whether an element placed here is where it stood; one that stood nowhere has not moved. */
export const staysAt = (
  stood: Stood,
  id: string,
  x: number,
  y: number,
): boolean => {
  const was = stood.get(id);
  return (
    was === undefined ||
    (Math.abs(was.x - x) <= STAYS_WITHIN && Math.abs(was.y - y) <= STAYS_WITHIN)
  );
};

/** What a container holds, in the order it is set out in. */
export type KidsOf = (parent: string | null) => readonly DrawnElement[];

const NO_KIDS: readonly DrawnElement[] = [];

/** What each container holds, the canvas itself under `null`, as the graph lists them. */
export function childrenOf(
  graph: Pick<ExplorationGraph, 'elements'>,
): Map<string | null, DrawnElement[]> {
  const children = new Map<string | null, DrawnElement[]>();
  for (const element of graph.elements) {
    const held = children.get(element.parent);
    if (held === undefined) children.set(element.parent, [element]);
    else held.push(element);
  }
  return children;
}

/**
 * Places what is drawn inside `within` — the whole diagram, or one frame's
 * own elements with all they hold — in the order `kidsOf` gives each
 * container's elements: set out in a square, the container sized around
 * them. Its own elements are placed from the corner of what they cover.
 * Given where the elements `stood`, each container keeps its rows as they
 * were where it can.
 */
export function placedIn(
  graph: ExplorationGraph,
  kidsOf: KidsOf,
  within: string | null = null,
  stood?: Stood,
): Placement {
  /** What a container holds, placed inside its padding, each before what it holds itself. */
  const setOut = (
    parent: string | null,
    corner: Readonly<Padding>,
    round: Round,
  ) => {
    const kids = kidsOf(parent);
    const sized = kids.map(sizeOf);
    // Where they stood is from their container's corner; a frame's own
    // elements, placed from the corner of its room, stood inside its padding.
    const from =
      parent === within && frame !== undefined
        ? paddingOf(frame, graph)
        : corner;
    const rows = setOutInSquare(
      sized,
      round,
      stood === undefined
        ? undefined
        : (at) =>
            kids.reduce(
              (moved, { id }, each) =>
                staysAt(
                  stood,
                  id,
                  from.left + at[each]!.x,
                  from.top + at[each]!.y,
                )
                  ? moved
                  : moved + 1,
              0,
            ),
    );
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
    if (kidsOf(element.id).length === 0)
      return { ...cardSizeOf(element, graph), holds: false, inside: [] };
    const round = roundOf(element);
    const held = setOut(element.id, paddingOf(element, graph), round);
    return {
      width: Math.max(round.least, held.width + round.across),
      height: Math.max(HEIGHT, held.height + round.down),
      holds: true,
      inside: held.placed,
    };
  };

  /** What is round what a frame holds: its padding, and how wide it is at least. */
  const roundOf = (frame: DrawnElement): Round => {
    const padding = paddingOf(frame, graph);
    return {
      across: padding.left + padding.right,
      down: padding.top + padding.bottom,
      least: frameLeastWidthOf(frame, graph),
    };
  };

  // One frame's own elements are placed from the corner of its room, but
  // shaped as when the whole diagram is placed: its name and padding counted.
  const frame =
    within === null
      ? undefined
      : graph.elements.find(({ id }) => id === within);
  return {
    elements: setOut(
      within,
      NO_PADDING,
      frame === undefined ? NOTHING_ROUND : roundOf(frame),
    ).placed,
  };
}

/**
 * Places what is drawn inside `within` with each container's elements in
 * the order of their kinds (exploration-order.ts).
 */
export function layoutExploration(
  graph: ExplorationGraph,
  within: string | null = null,
): Placement {
  const ordered = new Map(
    [...childrenOf(graph)].map(([parent, kids]) => [
      parent,
      inPlacingOrder(kids),
    ]),
  );
  return placedIn(graph, (parent) => ordered.get(parent) ?? NO_KIDS, within);
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
