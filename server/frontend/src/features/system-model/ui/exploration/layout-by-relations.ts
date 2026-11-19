import {
  type DrawnElement,
  type ExplorationGraph,
  inPlacingOrder,
} from '../../system-model-exploration.ts';
import {
  childrenOf,
  paddingOf,
  type PlacedElement,
  type Placement,
  placedIn,
  staysAt,
  type Stood,
} from './layout-exploration.ts';

/*
 * A placing that reads the relations: each container's elements are still
 * set out in a square, the room between them the same, but in the order
 * that tangles the edges least — fewest of them through a card that is
 * neither of their ends, fewest crossing each other, and then the shortest.
 * It is how the diagram is placed; the placing by kinds alone
 * (layout-exploration.ts) is kept behind a dev tools flag (`placeByKinds`).
 *
 * It is a search, not a formula. It starts with what is joined set side by
 * side, then tries each two elements of a container in each other's place,
 * the whole diagram placed anew and read each time, and keeps a change that
 * tangles it less; until none does, or its time is up.
 *
 * A diagram placed before is not placed from nothing. The search starts
 * from the order the elements stand in, what is new set after them, and
 * counts each element it would move against a change: one is moved to
 * take an edge out of a card or uncross two, never only to shorten one. A
 * placing asked for again, with nothing changed, moves nothing.
 */

/** How the edges of a placing tangle. */
export interface Tangle {
  /** Edges that run through a card or frame that is neither of their ends, nor round one. */
  through: number;
  /** Pairs of edges that cross. */
  crossings: number;
  /** How long the edges are together, end to end. */
  length: number;
}

/** What each is worth: an edge through a card is worse than a crossing, and a crossing than a long way round. */
const THROUGH = 10;
const CROSSING = 6;
const LENGTH = 1 / 1000;
/**
 * What moving one element from where it stood costs: less than a crossing
 * it clears, more than any edge it only shortens.
 */
const MOVED = 1.5;

const weighOf = ({ through, crossings, length }: Tangle) =>
  through * THROUGH + crossings * CROSSING + length * LENGTH;

/** Which side of the line from a to b a point is on. */
const sideOf = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);

/**
 * What reads a placing of this graph for how its edges tangle. Each edge is
 * read as the straight line between the middles of its two ends, as the
 * canvas draws it between their borders. All that does not change from one
 * placing to the next — the pairs joined, what each edge may run through —
 * is worked out once.
 */
function tangleReaderOf(graph: ExplorationGraph) {
  const count = graph.elements.length;
  const index = new Map(graph.elements.map(({ id }, at) => [id, at]));
  const parentOf = graph.elements.map(({ parent }) =>
    parent === null ? -1 : (index.get(parent) ?? -1),
  );
  /** Whether one is drawn round the other, at any depth. */
  const isRound = (outer: number, inner: number) => {
    for (let at = parentOf[inner]!; at >= 0; at = parentOf[at]!)
      if (at === outer) return true;
    return false;
  };

  // Each pair joined once, however many relations join it.
  const pairs = new Set<string>();
  const edges: (readonly [number, number])[] = [];
  for (const { source, target } of graph.relations) {
    const from = index.get(source);
    const to = index.get(target);
    if (from === undefined || to === undefined || from === to) continue;
    const pair = from < to ? `${from}-${to}` : `${to}-${from}`;
    if (pairs.has(pair)) continue;
    pairs.add(pair);
    edges.push([from, to]);
  }
  // What an edge may run through: all but its ends, what is round them, and
  // what they hold — the edge starts at an end's border, clear of those.
  const inTheWay = edges.map(([from, to]) => {
    const others: number[] = [];
    for (let at = 0; at < count; at++)
      if (
        at !== from &&
        at !== to &&
        !isRound(at, from) &&
        !isRound(at, to) &&
        !isRound(from, at) &&
        !isRound(to, at)
      )
        others.push(at);
    return others;
  });

  const left = new Float64Array(count);
  const top = new Float64Array(count);
  const right = new Float64Array(count);
  const bottom = new Float64Array(count);

  /** Whether the line from one point to another runs through a card. */
  const runsThrough = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    at: number,
  ) => {
    // Cut down to what of the line lies between the card's sides.
    let enter = 0;
    let leave = 1;
    const dx = bx - ax;
    const dy = by - ay;
    const cuts: (readonly [number, number])[] = [
      [-dx, ax - left[at]!],
      [dx, right[at]! - ax],
      [-dy, ay - top[at]!],
      [dy, bottom[at]! - ay],
    ];
    for (const [step, room] of cuts) {
      if (step === 0) {
        if (room < 0) return false;
        continue;
      }
      const reach = room / step;
      if (step < 0) enter = Math.max(enter, reach);
      else leave = Math.min(leave, reach);
      if (enter >= leave) return false;
    }
    return true;
  };

  return {
    /** Whether anything is joined at all. */
    joined: edges.length > 0,
    read(placed: readonly PlacedElement[]): Tangle {
      // A container is placed before what it holds, each relative to it.
      for (const { element, x, y, width, height } of placed) {
        const at = index.get(element.id);
        if (at === undefined) continue;
        const round = parentOf[at]!;
        left[at] = x + (round < 0 ? 0 : left[round]!);
        top[at] = y + (round < 0 ? 0 : top[round]!);
        right[at] = left[at]! + width;
        bottom[at] = top[at]! + height;
      }
      const midX = (at: number) => (left[at]! + right[at]!) / 2;
      const midY = (at: number) => (top[at]! + bottom[at]!) / 2;
      let through = 0;
      let crossings = 0;
      let length = 0;
      for (let one = 0; one < edges.length; one++) {
        const [from, to] = edges[one]!;
        const ax = midX(from);
        const ay = midY(from);
        const bx = midX(to);
        const by = midY(to);
        length += Math.hypot(bx - ax, by - ay);
        for (const at of inTheWay[one]!)
          if (runsThrough(ax, ay, bx, by, at)) through++;
        for (let other = one + 1; other < edges.length; other++) {
          const [start, end] = edges[other]!;
          // Two edges of one card meet at it; they do not cross.
          if (start === from || start === to || end === from || end === to)
            continue;
          const cx = midX(start);
          const cy = midY(start);
          const dx = midX(end);
          const dy = midY(end);
          if (
            sideOf(ax, ay, bx, by, cx, cy) * sideOf(ax, ay, bx, by, dx, dy) <
              0 &&
            sideOf(cx, cy, dx, dy, ax, ay) * sideOf(cx, cy, dx, dy, bx, by) < 0
          )
            crossings++;
        }
      }
      return { through, crossings, length };
    },
  };
}

/** How the edges of a placing of this graph tangle. */
export const tangleOf = (
  graph: ExplorationGraph,
  placed: readonly PlacedElement[],
): Tangle => tangleReaderOf(graph).read(placed);

/**
 * How much joins each two elements of one container: a relation between two
 * elements counts for the two the container holds that they are, or are
 * drawn inside. By the two ids, the lesser first.
 */
function joinsOf(graph: ExplorationGraph) {
  const parentOf = new Map(
    graph.elements.map(({ id, parent }) => [id, parent]),
  );
  /** An element and each frame round it, from the outermost in. */
  const wayTo = (id: string): string[] => {
    const way = [id];
    for (let at = parentOf.get(id) ?? null; at !== null;)
      [way[way.length], at] = [at, parentOf.get(at) ?? null];
    return way.reverse();
  };
  const joins = new Map<string, number>();
  for (const { source, target } of graph.relations) {
    if (!parentOf.has(source) || !parentOf.has(target)) continue;
    const from = wayTo(source);
    const to = wayTo(target);
    // Where their ways part, they are two elements of one container.
    let at = 0;
    while (at < from.length && at < to.length && from[at] === to[at]) at++;
    const [one, other] = [from[at], to[at]];
    if (one === undefined || other === undefined) continue;
    const pair = one < other ? `${one} ${other}` : `${other} ${one}`;
    joins.set(pair, (joins.get(pair) ?? 0) + 1);
  }
  return (one: string, other: string) =>
    joins.get(one < other ? `${one} ${other}` : `${other} ${one}`) ?? 0;
}

/**
 * A container's elements with what is joined set side by side: the one
 * joined to most first, then each time the one joined most to those set
 * out already. What is joined to nothing comes last. Among equals, the
 * order of their kinds (exploration-order.ts).
 */
function sideBySide(
  kids: readonly DrawnElement[],
  joins: (one: string, other: string) => number,
): DrawnElement[] {
  const waiting = inPlacingOrder(kids);
  const inAll = new Map(
    waiting.map(({ id }) => [
      id,
      waiting.reduce((all, other) => all + joins(id, other.id), 0),
    ]),
  );
  const out: DrawnElement[] = [];
  while (waiting.length > 0) {
    let pick = 0;
    let most = -1;
    let mostInAll = -1;
    waiting.forEach(({ id }, at) => {
      const toThose = out.reduce((all, other) => all + joins(id, other.id), 0);
      const all = inAll.get(id) ?? 0;
      if (toThose > most || (toThose === most && all > mostInAll))
        [pick, most, mostInAll] = [at, toThose, all];
    });
    out.push(...waiting.splice(pick, 1));
  }
  return out;
}

/**
 * How near in height two elements stood to have stood in one row. Placed
 * by the diagram, an element stands exactly where the one before it left
 * it; set by hand, two in a row are seldom level.
 */
const AS_PLACED = 0.5;
const BY_HAND = 28;

/**
 * A container's elements in the order they stood in — from the top, those
 * level with each other from the left; what stood nowhere — just put on
 * the diagram — after them, in the order of its kind. Null when none of
 * them stood anywhere.
 */
function asTheyStood(
  kids: readonly DrawnElement[],
  stood: Stood,
  level: number,
): DrawnElement[] | null {
  const there = kids
    .flatMap((kid) => {
      const at = stood.get(kid.id);
      return at === undefined ? [] : [{ kid, ...at }];
    })
    .toSorted((a, b) => a.y - b.y || a.x - b.x);
  if (there.length === 0) return null;
  const rows: (typeof there)[] = [];
  for (const each of there) {
    const row = rows.at(-1);
    if (row !== undefined && each.y - row[0]!.y <= level) row.push(each);
    else rows.push([each]);
  }
  return [
    ...rows.flatMap((row) =>
      row.toSorted((a, b) => a.x - b.x).map(({ kid }) => kid),
    ),
    ...inPlacingOrder(kids.filter(({ id }) => !stood.has(id))),
  ];
}

/** How long the search may go on, and how many placings it may try. */
export interface SearchLimit {
  ms: number;
  tries: number;
}
/** For a placing the reader asked for: worth a moment's wait. */
export const THOROUGH: SearchLimit = { ms: 1200, tries: 20000 };
/** For a placing the diagram does itself, as elements are put on it: not to be waited for. */
export const QUICK: SearchLimit = { ms: 300, tries: 20000 };

const NO_KIDS: readonly DrawnElement[] = [];

/** What is drawn inside a frame, all the way down, and the relations among it. */
function insideOf(graph: ExplorationGraph, frame: string): ExplorationGraph {
  const inside = new Set<string>();
  // A container stands before what it holds, so one pass finds them all.
  const kids = childrenOf(graph);
  const gather = (parent: string) => {
    for (const { id } of kids.get(parent) ?? NO_KIDS) {
      inside.add(id);
      gather(id);
    }
  };
  gather(frame);
  return {
    ...graph,
    elements: graph.elements.filter(({ id }) => inside.has(id)),
    relations: graph.relations.filter(
      ({ source, target }) => inside.has(source) && inside.has(target),
    ),
  };
}

/**
 * Places what is drawn inside `within` — the whole diagram, or one frame's
 * own elements with all they hold — with each container's elements in the
 * order that tangles its edges least (see the head of this file). A frame
 * is untangled for the relations among what it holds; those that leave it
 * are not read. With nothing joined there is nothing to untangle, and the
 * elements are in the order of their kinds — or, given where they `stood`,
 * in the order they stood in.
 */
export function layoutByRelations(
  graph: ExplorationGraph,
  within: string | null = null,
  limit: SearchLimit = THOROUGH,
  stood?: Stood,
): Placement {
  const read = within === null ? graph : insideOf(graph, within);
  const joins = joinsOf(read);
  /** Each container's elements as they stood, read that strictly; else what is joined side by side. */
  const orderBy = (level: number) =>
    new Map(
      [...childrenOf(read)].map(([parent, kids]) => [
        parent,
        (stood === undefined ? null : asTheyStood(kids, stood, level)) ??
          sideBySide(kids, joins),
      ]),
    );
  let order = orderBy(AS_PLACED);
  const kidsOf = (parent: string | null) => order.get(parent) ?? NO_KIDS;
  const reader = tangleReaderOf(read);

  // A frame's own elements are placed from the corner of its room; they
  // stood inside its padding.
  const frame =
    within === null
      ? undefined
      : graph.elements.find(({ id }) => id === within);
  const room = frame === undefined ? null : paddingOf(frame, graph);
  /** How many elements a placing moves from where they stood. */
  const movedIn = (placed: readonly PlacedElement[]) => {
    if (stood === undefined) return 0;
    let moved = 0;
    for (const { element, x, y } of placed) {
      const own = room !== null && element.parent === within;
      if (
        !staysAt(
          stood,
          element.id,
          x + (own ? room.left : 0),
          y + (own ? room.top : 0),
        )
      )
        moved++;
    }
    return moved;
  };
  const weigh = (placed: readonly PlacedElement[]) =>
    weighOf(reader.read(placed)) + movedIn(placed) * MOVED;

  // Cards set by hand are seldom level: read as rows, their order may put
  // more of them back where they stand than read to the pixel.
  if (stood !== undefined) {
    const strictly = movedIn(placedIn(graph, kidsOf, within, stood).elements);
    const placedOrder = order;
    order = orderBy(BY_HAND);
    if (movedIn(placedIn(graph, kidsOf, within, stood).elements) >= strictly)
      order = placedOrder;
  }

  const until = performance.now() + limit.ms;
  let tries = 0;
  const outOfTime = () => ++tries > limit.tries || performance.now() > until;

  // What is new among elements that stood is tried in each place among
  // them, and set where the whole then moves and tangles least — into the
  // gap one taken off left, where there is one; else after the rest.
  if (stood !== undefined)
    for (const kids of order.values()) {
      const fresh = kids.filter(({ id }) => !stood.has(id));
      if (fresh.length === kids.length) continue;
      for (const one of fresh) {
        kids.splice(kids.indexOf(one), 1);
        let lightest = Infinity;
        let place = kids.length;
        // From the end, which an equal place further in does not better.
        for (let at = kids.length; at >= 0 && !outOfTime(); at--) {
          kids.splice(at, 0, one);
          const weight = weigh(placedIn(graph, kidsOf, within, stood).elements);
          if (weight < lightest - 1e-9) [lightest, place] = [weight, at];
          kids.splice(at, 1);
        }
        kids.splice(place, 0, one);
      }
    }

  let best = placedIn(graph, kidsOf, within, stood);
  if (!reader.joined) return best;
  let least = weigh(best.elements);
  for (let better = true; better;) {
    better = false;
    for (const kids of order.values())
      for (let one = 0; one < kids.length - 1; one++)
        for (let other = one + 1; other < kids.length; other++) {
          if (outOfTime()) return best;
          // Each in the other's place.
          [kids[one], kids[other]] = [kids[other]!, kids[one]!];
          const placed = placedIn(graph, kidsOf, within, stood);
          const weight = weigh(placed.elements);
          if (weight < least - 1e-9) {
            best = placed;
            least = weight;
            better = true;
          } else [kids[one], kids[other]] = [kids[other]!, kids[one]!];
        }
  }
  return best;
}
