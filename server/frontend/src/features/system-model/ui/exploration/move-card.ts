import { encloses, type Rect } from '#/shared/ui/diagram-canvas/geometry.ts';
import type { ExplorationGraph } from '../../system-model-exploration.ts';
import {
  type CanvasPoint,
  type CanvasRect,
  centreOf,
  overlaps,
  refusing,
  workspaceOf,
} from './canvas-workspace.ts';
import { type PlacedElement, SPACING } from './layout-exploration.ts';

/*
 * A card dragged and dropped: the frames it may not land in, where it
 * lands, and the canvas once it has.
 */

/** The frames this card may not land in, to tell while it is dragged. */
export function refusingFrames(
  previous: readonly PlacedElement[],
  graph: ExplorationGraph,
  id: string,
): CanvasRect[] {
  return refusing(workspaceOf(previous, graph), graph, id);
}

/** Whether a card standing there lands in one of these frames: its centre is inside. */
export const landsIn = (frames: readonly CanvasRect[], rect: CanvasRect) =>
  frames.some((frame) => encloses(frame, centreOf(rect)));

/**
 * A card dropped where the reader let go of it, `to` on the canvas, with
 * all it holds: it stays inside its container wherever it lands, and the
 * container is fitted round what it holds again — grown, pushing aside
 * whatever it then reaches, or shrunk. Let go of inside another module, it
 * stays at its own level, just outside that module: at the free side
 * nearest where it was let go of, or, with none free, the nearest side.
 * Whatever beside it it then lies on moves off it, and so on. The rest
 * stays put; null if the pushing will not settle.
 */
export function movedTo(
  previous: readonly PlacedElement[],
  graph: ExplorationGraph,
  id: string,
  to: CanvasPoint,
): PlacedElement[] | null {
  const workspace = workspaceOf(previous, graph);
  const { rects, byId, move, refit, shove, settle, placed } = workspace;
  if (!settle()) return null;
  const from = rects.get(id);
  if (from === undefined) return null;
  const frames = refusing(workspace, graph, id);
  const dropped = { ...from, ...to };
  // The outermost module it was let go of in: outside that, it is back at
  // its own level.
  const into = frames
    .filter((frame) => encloses(frame, centreOf(dropped)))
    .sort((a, b) => b.width * b.height - a.width * a.height)[0];
  let at: Rect = dropped;
  if (into !== undefined) {
    const sides = [
      { ...dropped, x: into.x - SPACING - dropped.width },
      { ...dropped, x: into.x + into.width + SPACING },
      { ...dropped, y: into.y - SPACING - dropped.height },
      { ...dropped, y: into.y + into.height + SPACING },
    ];
    const distance = (rect: Rect) =>
      Math.hypot(rect.x - dropped.x, rect.y - dropped.y);
    const byNearness = sides.sort((a, b) => distance(a) - distance(b));
    const free = byNearness.find((side) =>
      frames.every((frame) => !overlaps(side, frame)),
    );
    at = free ?? byNearness[0]!;
  }
  move(id, at.x - from.x, at.y - from.y);
  // What it then lies on makes way, and what that lies on in turn.
  if (!shove(id, id)) return null;
  return refit(byId.get(id)?.parent ?? null) ? placed() : null;
}
