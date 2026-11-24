import type { ReactFlowInstance, Rect } from '@xyflow/react';

/*
 * An element read about in the details panel, brought to the middle of the
 * canvas: what a link there does, on every diagram, to an element the
 * diagram draws.
 */

/** What the details dock covers of a canvas, from its right: 360px, 16px in, and a gap. */
export const DOCK_ROOM = 420;

/** How long the canvas takes to move to it. */
const CENTRE_MS = 400;

/** What of a canvas's React Flow it takes, whatever its cards. */
interface Canvas {
  getNode: (id: string) => { hidden?: boolean } | undefined;
  getNodesBounds: (ids: string[]) => Rect;
  getZoom: () => number;
  setCenter: ReactFlowInstance['setCenter'];
}

/**
 * Puts a card in the middle of the canvas left of the details dock, at the
 * zoom it is at: the first of these ids the canvas draws in sight — an
 * element can be drawn by a card of another id, as a module by its
 * hexagon — and nothing when it draws none of them.
 */
export function centreOn(flow: Canvas, ids: readonly string[]): void {
  const card = ids.find((id) => {
    const node = flow.getNode(id);
    return node !== undefined && node.hidden !== true;
  });
  if (card === undefined) return;
  const bounds = flow.getNodesBounds([card]);
  const zoom = flow.getZoom();
  void flow.setCenter(
    // Half the dock's room further right, so the middle is that of what
    // the dock leaves in sight.
    bounds.x + bounds.width / 2 + DOCK_ROOM / 2 / zoom,
    bounds.y + bounds.height / 2,
    { zoom, duration: CENTRE_MS },
  );
}
