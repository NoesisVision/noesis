import { useReactFlow, useStoreApi } from '@xyflow/react';
import { type MouseEvent, type PointerEvent } from 'react';

/*
 * A frame panned and zoomed from its own room, a click on its empty space
 * selecting it.
 */

/** How far a pointer may move between press and release and still be a click. */
export const CLICK_SLOP = 4;

/*
 * A frame's room for what it holds is the canvas's, to the reader: pressed
 * and dragged, it moves the view, and double-clicked it zooms in round the
 * pointer, as the empty canvas does. React Flow keeps both from a node it
 * drags, frames included, though a frame is dragged by its top alone; so
 * they are done here, on the room itself and nothing in it. Clicked, not
 * dragged, the room is the frame's, and takes it in hand.
 */
export function useViewingFromFrame(onClick: (adding: boolean) => void) {
  const { getViewport, setViewport } = useReactFlow();
  const store = useStoreApi();
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    const room = event.currentTarget;
    const from = { x: event.clientX, y: event.clientY, view: getViewport() };
    room.setPointerCapture(event.pointerId);
    room.dataset.panning = '';
    const move = (to: globalThis.PointerEvent) =>
      void setViewport({
        ...from.view,
        x: from.view.x + to.clientX - from.x,
        y: from.view.y + to.clientY - from.y,
      });
    const end = (to: globalThis.PointerEvent) => {
      // Let go where it was pressed, it was a click on the room, not a pan:
      // that takes the frame in hand, as a click on its name does.
      if (
        to.type === 'pointerup' &&
        Math.hypot(to.clientX - from.x, to.clientY - from.y) < CLICK_SLOP
      )
        onClick(to.ctrlKey || to.metaKey);
      delete room.dataset.panning;
      room.removeEventListener('pointermove', move);
      room.removeEventListener('pointerup', end);
      room.removeEventListener('pointercancel', end);
    };
    room.addEventListener('pointermove', move);
    room.addEventListener('pointerup', end);
    room.addEventListener('pointercancel', end);
  };
  const onDoubleClick = (event: MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    const canvas = event.currentTarget.closest('.react-flow');
    if (canvas === null) return;
    const box = canvas.getBoundingClientRect();
    const at = { x: event.clientX - box.left, y: event.clientY - box.top };
    const view = getViewport();
    // Twice as close, the point under the pointer staying under it.
    const zoom = Math.min(store.getState().maxZoom, view.zoom * 2);
    const by = zoom / view.zoom;
    void setViewport(
      { x: at.x - (at.x - view.x) * by, y: at.y - (at.y - view.y) * by, zoom },
      { duration: 250 },
    );
  };
  return { onPointerDown, onDoubleClick };
}
