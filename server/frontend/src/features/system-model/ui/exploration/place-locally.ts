import type {
  DrawnElement,
  ExplorationGraph,
} from '../../system-model-exploration.ts';
import {
  frameWidthOf,
  heightOf,
  paddingOf,
  type PlacedElement,
  SPACING,
  widthOf,
} from './layout-exploration.ts';

/*
 * The diagram changed from one card, placed without moving the rest: what
 * stays keeps where it stands, what is gone is only gone, and what comes is
 * set beside that card where nothing else stands — inside its container
 * when it has one drawn, the container growing to hold it and pushing
 * aside whatever it then reaches. A container a card brings round others
 * already drawn is drawn round them; if it would then lie over anything
 * else, there is no placing it here, and the caller places everything anew.
 *
 * Positions are worked out on the canvas, then made relative to each
 * element's container, as React Flow reads them.
 */

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How close two cards may come without one standing on the other. */
const MARGIN = SPACING / 2;
/** How many pushes one change may take before it is placed anew instead. */
const PUSHES = 500;

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width + MARGIN &&
  b.x < a.x + a.width + MARGIN &&
  a.y < b.y + b.height + MARGIN &&
  b.y < a.y + a.height + MARGIN;

const centreOf = (rect: Rect) => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

const union = (a: Rect, b: Rect): Rect => {
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
function workspaceOf(
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

  const byId = new Map(graph.elements.map((each) => [each.id, each]));
  const children = new Map<string | null, DrawnElement[]>();
  for (const element of graph.elements)
    children.set(element.parent, [
      ...(children.get(element.parent) ?? []),
      element,
    ]);
  const kidsOf = (id: string | null) => children.get(id) ?? [];

  // What stays keeps its place on the canvas; a container left holding
  // nothing is a card again. A card is as tall as what it now offers, and a
  // frame has room at its bottom as it does: they settle once all is known.
  const rects = new Map<string, Rect>();
  const resized: { id: string; old: Rect }[] = [];
  for (const element of graph.elements) {
    const rect = absoluteOf(element.id);
    const was = before.get(element.id);
    if (rect === null || was === undefined) continue;
    const next =
      kidsOf(element.id).length === 0
        ? {
            ...rect,
            width: was.holds ? widthOf(element.name) : rect.width,
            height: heightOf(element),
          }
        : {
            ...rect,
            height:
              rect.height +
              paddingOf(element).bottom -
              paddingOf(was.element).bottom,
          };
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
    const padding = paddingOf(element);
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
   * into is pushed aside. A frame left holding nothing is a card already,
   * so its container is fitted instead.
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
    const padding = paddingOf(element);
    const next = {
      x: box.x - padding.left,
      y: box.y - padding.top,
      width: Math.max(
        frameWidthOf(element.name),
        box.width + padding.left + padding.right,
      ),
      height: Math.max(
        heightOf(element),
        box.height + padding.top + padding.bottom,
      ),
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
    ) && [...leftBehind].every((id) => refit(id));

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
    settle,
    placed,
  };
}

/** A point on the canvas, for an element to be set down at. */
export interface CanvasPoint {
  x: number;
  y: number;
}

export function placeLocally(
  previous: readonly PlacedElement[],
  graph: ExplorationGraph,
  /** The card the change came from, or the point it was asked for at. */
  anchor: string | CanvasPoint,
): PlacedElement[] | null {
  const {
    rects,
    byId,
    placedKids,
    descendantsOf,
    ancestorsOf,
    fit,
    settle,
    placed,
  } = workspaceOf(previous, graph);
  if (!settle()) return null;
  const point = typeof anchor === 'string' ? null : anchor;
  const card = typeof anchor === 'string' ? anchor : null;

  const anchorRect = (point === null
    ? undefined
    : { ...point, width: 0, height: 0 }) ??
    (card === null ? undefined : rects.get(card)) ??
    [...rects.values()].reduce<Rect | null>(
      (all, rect) => (all === null ? rect : union(all, rect)),
      null,
    ) ?? { x: 0, y: 0, width: 0, height: 0 };
  const near = (rect: Rect) => {
    const a = centreOf(rect);
    const b = centreOf(anchorRect);
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  /** The free spot for a card of this size nearest the anchor, among those offered. */
  const spotFor = (
    width: number,
    height: number,
    around: Rect[],
    standing: Rect[],
    start: { x: number; y: number } | null,
    room: Rect | null,
  ): Rect => {
    const at = (x: number, y: number) => ({ x, y, width, height });
    const candidates = [
      ...(start === null ? [] : [at(start.x, start.y)]),
      ...around.flatMap((rect) => [
        at(rect.x + rect.width + SPACING, rect.y),
        at(rect.x, rect.y + rect.height + SPACING),
        at(rect.x - SPACING - width, rect.y),
        at(rect.x, rect.y - SPACING - height),
      ]),
    ];
    const free = candidates.filter((spot) =>
      standing.every((rect) => !overlaps(spot, rect)),
    );
    // Inside the room it has first, then nearest the card it came from.
    const outside = (spot: Rect) =>
      room === null ||
      (spot.x >= room.x &&
        spot.y >= room.y &&
        spot.x + spot.width <= room.x + room.width &&
        spot.y + spot.height <= room.y + room.height)
        ? 0
        : 1;
    return (
      free.sort((a, b) => outside(a) - outside(b) || near(a) - near(b))[0] ??
      // Past everything there is, which nothing can stand on.
      at(
        Math.max(...standing.map((rect) => rect.x + rect.width), 0) + SPACING,
        anchorRect.y,
      )
    );
  };

  const place = (element: DrawnElement): boolean => {
    const held = placedKids(element.id).map(({ id }) => rects.get(id)!);
    const parent = element.parent;
    const [first, ...others] = held;
    if (first !== undefined) {
      // A container round what is already drawn of it.
      const box = others.reduce((all, rect) => union(all, rect), first);
      const padding = paddingOf(element);
      const rect = {
        x: box.x - padding.left,
        y: box.y - padding.top,
        width: Math.max(
          frameWidthOf(element.name),
          box.width + padding.left + padding.right,
        ),
        height: box.height + padding.top + padding.bottom,
      };
      const inside = new Set([
        ...descendantsOf(element.id),
        ...ancestorsOf(element.id),
      ]);
      for (const [id, other] of rects)
        if (!inside.has(id) && overlaps(rect, other)) return false;
      rects.set(element.id, rect);
      return fit(parent);
    }
    const width = widthOf(element.name);
    const height = heightOf(element);
    if (parent !== null) {
      const container = rects.get(parent);
      const holder = byId.get(parent);
      if (container === undefined || holder === undefined) return false;
      const padding = paddingOf(holder);
      const siblings = placedKids(parent)
        .filter(({ id }) => id !== element.id)
        .map(({ id }) => rects.get(id)!);
      const room = {
        x: container.x + padding.left,
        y: container.y + padding.top,
        width: container.width - padding.left - padding.right,
        height: container.height - padding.top - padding.bottom,
      };
      rects.set(
        element.id,
        spotFor(
          width,
          height,
          siblings,
          siblings,
          siblings.length === 0 ? { x: room.x, y: room.y } : null,
          room,
        ),
      );
      return fit(parent);
    }
    const roots = placedKids(null).map(({ id }) => rects.get(id)!);
    // At the point itself, centred on it, when nothing stands there.
    if (point !== null) {
      rects.set(
        element.id,
        spotFor(
          width,
          height,
          roots,
          roots,
          { x: point.x - width / 2, y: point.y - height / 2 },
          null,
        ),
      );
      return true;
    }
    const top = card === null ? null : (ancestorsOf(card).at(-1) ?? card);
    const from = (top === null ? undefined : rects.get(top)) ?? anchorRect;
    rects.set(
      element.id,
      spotFor(width, height, [from, ...roots], roots, null, null),
    );
    return true;
  };

  // Each new element once its container stands, so it has a room to go in.
  const waiting = graph.elements.filter(({ id }) => !rects.has(id));
  while (waiting.length > 0) {
    const index = waiting.findIndex(
      ({ parent }) => parent === null || rects.has(parent),
    );
    if (index < 0) return null;
    const [element] = waiting.splice(index, 1);
    if (element === undefined || !place(element)) return null;
  }

  return placed();
}

/**
 * What one container holds set out anew, as `inside` places it — relative
 * to the container's room for it — the container fitted to it, larger or
 * smaller, and whatever it then reaches pushed aside; the rest stays put.
 */
export function arrangeWithin(
  previous: readonly PlacedElement[],
  graph: ExplorationGraph,
  id: string,
  inside: readonly PlacedElement[],
): PlacedElement[] | null {
  const { rects, byId, kidsOf, pushAround, fit, settle, placed } = workspaceOf(
    previous,
    graph,
  );
  if (!settle()) return null;
  const frame = rects.get(id);
  const element = byId.get(id);
  if (frame === undefined || element === undefined) return null;
  const padding = paddingOf(element);
  const origin = { x: frame.x + padding.left, y: frame.y + padding.top };
  const at = new Map(inside.map((each) => [each.element.id, each]));
  let right = frame.x + frameWidthOf(element.name);
  let bottom = frame.y + heightOf(element);
  const set = (parent: string, from: { x: number; y: number }) => {
    for (const { id: kid } of kidsOf(parent)) {
      const laid = at.get(kid);
      if (laid === undefined) return false;
      const rect = {
        x: from.x + laid.x,
        y: from.y + laid.y,
        width: laid.width,
        height: laid.height,
      };
      rects.set(kid, rect);
      right = Math.max(right, rect.x + rect.width + padding.right);
      bottom = Math.max(bottom, rect.y + rect.height + padding.bottom);
      if (!set(kid, rect)) return false;
    }
    return true;
  };
  if (!set(id, origin)) return null;
  rects.set(id, { ...frame, width: right - frame.x, height: bottom - frame.y });
  return pushAround(id, frame) && fit(element.parent) ? placed() : null;
}

/**
 * A card dropped where the reader let go of it, `to` on the canvas, with
 * all it holds: it stays inside its container wherever it lands, and the
 * container is fitted round what it holds again — grown, pushing aside
 * whatever it then reaches, or shrunk. The rest stays put; null if the
 * pushing will not settle.
 */
export function movedTo(
  previous: readonly PlacedElement[],
  graph: ExplorationGraph,
  id: string,
  to: CanvasPoint,
): PlacedElement[] | null {
  const { rects, byId, move, refit, settle, placed } = workspaceOf(
    previous,
    graph,
  );
  if (!settle()) return null;
  const from = rects.get(id);
  if (from === undefined) return null;
  move(id, to.x - from.x, to.y - from.y);
  return refit(byId.get(id)?.parent ?? null) ? placed() : null;
}
