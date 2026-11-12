import { type Rect } from '#/shared/ui/diagram-canvas/geometry.ts';
import type {
  DrawnElement,
  ExplorationGraph,
} from '../../system-model-exploration.ts';
import {
  type CanvasPoint,
  centreOf,
  overlaps,
  union,
  workspaceOf,
} from './canvas-workspace.ts';
import {
  frameWidthOf,
  HEIGHT,
  PADDING,
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

export * from './canvas-workspace.ts';
export * from './arrange-within.ts';
export * from './move-card.ts';

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
  const nearTo = (toward: Rect) => (rect: Rect) => {
    const a = centreOf(rect);
    const b = centreOf(toward);
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
    /** What it goes nearest to: the card or point it came from, else that. */
    toward: Rect = anchorRect,
  ): Rect => {
    const near = nearTo(toward);
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
    // Inside a container, never above or left of its room: the container
    // grows right and down to hold it, its top left corner where it was.
    const free = candidates.filter(
      (spot) =>
        (room === null || (spot.x >= room.x && spot.y >= room.y)) &&
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
        room?.y ?? anchorRect.y,
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
      const padding = PADDING;
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
    const height = HEIGHT;
    if (parent !== null) {
      const container = rects.get(parent);
      const holder = byId.get(parent);
      if (container === undefined || holder === undefined) return false;
      const padding = PADDING;
      const siblings = placedKids(parent)
        .filter(({ id }) => id !== element.id)
        .map(({ id }) => rects.get(id)!);
      const room = {
        x: container.x + padding.left,
        y: container.y + padding.top,
        width: container.width - padding.left - padding.right,
        height: container.height - padding.top - padding.bottom,
      };
      // Asked for at a point outside its module, it still goes in it, among
      // what it holds — never stretching the module out to that point.
      const pointIn =
        point !== null &&
        point.x >= room.x &&
        point.y >= room.y &&
        point.x <= room.x + room.width &&
        point.y <= room.y + room.height
          ? point
          : null;
      rects.set(
        element.id,
        spotFor(
          width,
          height,
          siblings,
          siblings,
          // Asked for at a point inside the container: centred on it, kept
          // inside the room; else, with nothing beside it, at its corner.
          pointIn !== null
            ? {
                x: Math.max(room.x, pointIn.x - width / 2),
                y: Math.max(room.y, pointIn.y - height / 2),
              }
            : siblings.length === 0
              ? { x: room.x, y: room.y }
              : null,
          room,
          point !== null && pointIn === null ? container : anchorRect,
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
