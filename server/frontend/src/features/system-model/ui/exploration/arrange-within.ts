import type { ExplorationGraph } from '../../system-model-exploration.ts';
import { workspaceOf } from './canvas-workspace.ts';
import {
  frameWidthOf,
  HEIGHT,
  PADDING,
  type PlacedElement,
} from './layout-exploration.ts';

/*
 * Setting out again what a frame holds, the frame fitted round it.
 */

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
  const padding = PADDING;
  const origin = { x: frame.x + padding.left, y: frame.y + padding.top };
  const at = new Map(inside.map((each) => [each.element.id, each]));
  let right = frame.x + frameWidthOf(element.name);
  let bottom = frame.y + HEIGHT;
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
