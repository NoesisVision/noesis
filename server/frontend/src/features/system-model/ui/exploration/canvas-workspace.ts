import { byIdOf } from '#/shared/collections.ts';
import { type Point, type Rect } from '#/shared/ui/diagram-canvas/geometry.ts';
import type {
  DrawnElement,
  ExplorationGraph,
} from '../../system-model-exploration.ts';
import {
  frameWidthOf,
  HEIGHT,
  PADDING,
  type PlacedElement,
  SPACING,
  widthOf,
} from './layout-exploration.ts';

/*
 * A canvas being rearranged: every card's and frame's box, kept in one
 * workspace whose moves share one map and one cap on how far pushes chain —
 * so it is kept whole, never spread over free functions.
 */

/** How close two cards may come without one standing on the other. */
const MARGIN = SPACING / 2;

/** How many pushes one change may take before it is placed anew instead. */
const PUSHES = 500;

export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width + MARGIN &&
  b.x < a.x + a.width + MARGIN &&
  a.y < b.y + b.height + MARGIN &&
  b.y < a.y + a.height + MARGIN;

export const centreOf = (rect: Rect) => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

export const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};

const same = (a: Rect, b: Rect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/*
 * The canvas as it stands, worked on in place: every element's rect on it,
 * and the rules for growing a container round what it holds and pushing
 * aside what that reaches.
 */
export function workspaceOf(
  previous: readonly PlacedElement[],
  graph: ExplorationGraph,
) {
  const before = new Map(previous.map((each) => [each.element.id, each]));
  const absolute = new Map<string, Rect>();
  const absoluteOf = (id: string): Rect | null => {
    const known = absolute.get(id);
    if (known !== undefined) return known;
    const placed = before.get(id);
    if (placed === undefined) return null;
    const parent =
      placed.element.parent === null ? null : absoluteOf(placed.element.parent);
    const rect = {
      x: placed.x + (parent?.x ?? 0),
      y: placed.y + (parent?.y ?? 0),
      width: placed.width,
      height: placed.height,
    };
    absolute.set(id, rect);
    return rect;
  };

  const byId = byIdOf(graph.elements);
  const children = new Map<string | null, DrawnElement[]>();
  for (const element of graph.elements)
    children.set(element.parent, [
      ...(children.get(element.parent) ?? []),
      element,
    ]);
  const kidsOf = (id: string | null) => children.get(id) ?? [];

  // What stays keeps its place on the canvas; a container left holding
  // nothing is a card again, settled once all is known.
  const rects = new Map<string, Rect>();
  const resized: { id: string; old: Rect }[] = [];
  for (const element of graph.elements) {
    const rect = absoluteOf(element.id);
    const was = before.get(element.id);
    if (rect === null || was === undefined) continue;
    const next =
      kidsOf(element.id).length === 0 && was.holds
        ? { ...rect, width: widthOf(element.name), height: HEIGHT }
        : rect;
    rects.set(element.id, next);
    if (!same(next, rect)) resized.push({ id: element.id, old: rect });
  }

  const placedKids = (id: string | null) =>
    kidsOf(id).filter(({ id: kid }) => rects.has(kid));
  const descendantsOf = (id: string): string[] =>
    kidsOf(id).flatMap(({ id: kid }) => [kid, ...descendantsOf(kid)]);
  const ancestorsOf = (id: string): string[] => {
    const parent = byId.get(id)?.parent ?? null;
    return parent === null ? [] : [parent, ...ancestorsOf(parent)];
  };

  let pushes = 0;
  const move = (id: string, dx: number, dy: number) => {
    for (const each of [id, ...descendantsOf(id)]) {
      const rect = rects.get(each);
      if (rect !== undefined)
        rects.set(each, { ...rect, x: rect.x + dx, y: rect.y + dy });
    }
  };

  /**
   * Makes way round a card let go of: each card beside it that it now
   * lies on moves off it, the way it mostly lies from it — sideways if
   * further across than up or down, else up or down — and whatever that
   * one then lies on makes way for it in turn. `kept`, the card let go of,
   * never moves.
   */
  const shove = (id: string, kept: string): boolean => {
    const self = rects.get(id);
    if (self === undefined) return true;
    const parent = byId.get(id)?.parent ?? null;
    for (const { id: other } of placedKids(parent)) {
      if (other === id || other === kept) continue;
      const rect = rects.get(other);
      if (rect === undefined || !overlaps(self, rect)) continue;
      if (++pushes > PUSHES) return false;
      const from = centreOf(self);
      const to = centreOf(rect);
      const [dx, dy] =
        Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
          ? [
              to.x >= from.x
                ? self.x + self.width + SPACING - rect.x
                : self.x - SPACING - (rect.x + rect.width),
              0,
            ]
          : [
              0,
              to.y >= from.y
                ? self.y + self.height + SPACING - rect.y
                : self.y - SPACING - (rect.y + rect.height),
            ];
      move(other, dx, dy);
      if (!shove(other, kept)) return false;
    }
    return true;
  };

  /** Moves aside whatever stands beside `id` and now lies under it. */
  const pushAround = (id: string, old: Rect): boolean => {
    const grown = rects.get(id);
    if (grown === undefined) return true;
    const parent = byId.get(id)?.parent ?? null;
    for (const { id: other } of placedKids(parent)) {
      if (other === id) continue;
      const rect = rects.get(other);
      if (rect === undefined || !overlaps(grown, rect)) continue;
      if (++pushes > PUSHES) return false;
      const right = grown.x + grown.width + SPACING - rect.x;
      const down = grown.y + grown.height + SPACING - rect.y;
      const [dx, dy] =
        rect.x >= old.x + old.width
          ? [right, 0]
          : rect.y >= old.y + old.height
            ? [0, down]
            : right <= down
              ? [right, 0]
              : [0, down];
      move(other, dx, dy);
      if (!pushAround(other, rect)) return false;
    }
    return true;
  };

  /** Grows `id` round everything it holds, then its container round it. */
  const fit = (id: string | null): boolean => {
    if (id === null) return true;
    const old = rects.get(id);
    if (old === undefined) return true;
    const element = byId.get(id);
    if (element === undefined) return true;
    const padding = PADDING;
    let next = old;
    for (const { id: kid } of placedKids(id)) {
      const rect = rects.get(kid);
      if (rect === undefined) continue;
      next = union(next, {
        x: rect.x - padding.left,
        y: rect.y - padding.top,
        width: rect.width + padding.left + padding.right,
        height: rect.height + padding.top + padding.bottom,
      });
    }
    if (next.width < frameWidthOf(element.name))
      next = { ...next, width: frameWidthOf(element.name) };
    if (same(next, old)) return true;
    rects.set(id, next);
    return pushAround(id, old) && fit(element.parent);
  };

  /**
   * Fits `id` to what it holds, larger or smaller — never past its least
   * size — then its container to it, and so on up; what a container grows
   * into is pushed aside. Its top left corner stays where it is, so it
   * shrinks from the right and the bottom, and grows up or left only for a
   * card that now stands beyond that corner. A frame left holding nothing
   * is a card already, so its container is fitted instead.
   */
  const refit = (id: string | null): boolean => {
    if (id === null) return true;
    const old = rects.get(id);
    const element = byId.get(id);
    if (old === undefined || element === undefined) return true;
    const [first, ...others] = placedKids(id).map(({ id: kid }) =>
      rects.get(kid)!,
    );
    if (first === undefined) return refit(element.parent);
    const box = others.reduce((all, rect) => union(all, rect), first);
    const padding = PADDING;
    const x = Math.min(old.x, box.x - padding.left);
    const y = Math.min(old.y, box.y - padding.top);
    const next = {
      x,
      y,
      width: Math.max(
        frameWidthOf(element.name),
        box.x + box.width + padding.right - x,
      ),
      height: Math.max(HEIGHT, box.y + box.height + padding.bottom - y),
    };
    if (same(next, old)) return true;
    rects.set(id, next);
    return pushAround(id, old) && refit(element.parent);
  };

  // The containers something drawn inside them has left — taken off, or
  // its container taken off round it — fitted to what they still hold.
  const now = new Map(graph.elements.map(({ id, parent }) => [id, parent]));
  const leftBehind = new Set<string>();
  for (const { element } of previous)
    if (
      element.parent !== null &&
      rects.has(element.parent) &&
      now.get(element.id) !== element.parent
    )
      leftBehind.add(element.parent);

  /** What changed size as it stood moves the rest aside; false if it cannot. */
  const settle = () =>
    resized.every(
      ({ id, old }) =>
        fit(kidsOf(id).length > 0 ? id : null) &&
        pushAround(id, old) &&
        fit(byId.get(id)?.parent ?? null),
    ) && [...leftBehind].every((id) => lift(id) && refit(id));

  /**
   * What a container still holds raised together to the top of its room,
   * keeping how it stands among itself, so a gap left at the top by what
   * went closes and the container shrinks from its bottom.
   */
  const lift = (id: string): boolean => {
    const frame = rects.get(id);
    const element = byId.get(id);
    if (frame === undefined || element === undefined) return true;
    const held = placedKids(id);
    const top = Math.min(...held.map(({ id: kid }) => rects.get(kid)!.y));
    const gap = top - (frame.y + PADDING.top);
    if (held.length > 0 && gap > 0)
      for (const { id: kid } of held) move(kid, 0, -gap);
    return true;
  };

  /** Every element where it now stands, relative to its container, containers first. */
  const placed = (): PlacedElement[] => {
    const out: PlacedElement[] = [];
    const walk = (parent: string | null) => {
      const origin = parent === null ? null : rects.get(parent)!;
      for (const element of kidsOf(parent)) {
        const rect = rects.get(element.id)!;
        out.push({
          element,
          holds: kidsOf(element.id).length > 0,
          x: rect.x - (origin?.x ?? 0),
          y: rect.y - (origin?.y ?? 0),
          width: rect.width,
          height: rect.height,
        });
        walk(element.id);
      }
    };
    walk(null);
    return out;
  };

  return {
    rects,
    byId,
    kidsOf,
    placedKids,
    descendantsOf,
    ancestorsOf,
    move,
    fit,
    refit,
    pushAround,
    shove,
    settle,
    placed,
  };
}

/** A point on the canvas, for an element to be set down at. */
export type CanvasPoint = Point;

/** A card's place on the canvas, for the frames it may not land in. */
export type CanvasRect = Rect;

/*
 * The frames a card may not land in, where they stand on the canvas: those
 * drawn round others that are neither round it nor inside it. A card stays
 * at its own level, so it never goes into another module.
 */
export function refusing(
  workspace: ReturnType<typeof workspaceOf>,
  graph: ExplorationGraph,
  id: string,
): Rect[] {
  const { rects, placedKids, descendantsOf, ancestorsOf } = workspace;
  const own = new Set([id, ...descendantsOf(id), ...ancestorsOf(id)]);
  return graph.elements
    .filter(({ id: other }) => !own.has(other) && placedKids(other).length > 0)
    .flatMap(({ id: other }) => {
      const rect = rects.get(other);
      return rect === undefined ? [] : [rect];
    });
}
