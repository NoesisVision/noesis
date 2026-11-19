import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import type { Rect } from './geometry.ts';
import classes from './box-select.module.css';

/** How far the pointer goes before a press is a box and not a click, in pixels. */
const SLOP = 4;

/*
 * A box drawn over a canvas with Shift held, to take in hand all it covers.
 * A plain drag still moves the canvas, and a card pressed is still dragged:
 * the canvas says where a box may start. The press is kept from the canvas
 * on its way down, so the canvas neither moves nor drags for it, and the
 * box is placed on the page directly, so nothing is drawn again on the way.
 * Let go of, the box is handed over as it stood; Escape lets it go unused.
 *
 * Render it inside the element the canvas fills (`within`), which it is
 * placed against.
 */
export function BoxSelect({
  within,
  startsOn,
  onBox,
}: {
  within: RefObject<HTMLElement | null>;
  /** Whether a press on this starts a box: the empty canvas, not what is dragged. */
  startsOn: (target: Element) => boolean;
  /** The box drawn, in pixels of the page, once it is let go of. */
  onBox: (box: Rect) => void;
}) {
  const shown = useRef<HTMLDivElement>(null);
  // Read as a box is drawn, without listening anew when they change.
  const latest = useRef({ startsOn, onBox });
  useLayoutEffect(() => {
    latest.current = { startsOn, onBox };
  });
  useEffect(() => {
    const room = within.current;
    const box = shown.current;
    if (room === null || box === null) return;
    let stop: (() => void) | null = null;
    const onDown = (event: MouseEvent) => {
      if (!event.shiftKey || event.button !== 0) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const { target } = event;
      if (!(target instanceof Element) || !latest.current.startsOn(target))
        return;
      // The canvas's own: it would move, or drag what is pressed.
      event.stopPropagation();
      // No text is selected on the way.
      event.preventDefault();
      const start = { x: event.clientX, y: event.clientY };
      let drawn: Rect | null = null;
      const onMove = (move: MouseEvent) => {
        const across = move.clientX - start.x;
        const down = move.clientY - start.y;
        if (drawn === null && Math.hypot(across, down) < SLOP) return;
        drawn = {
          x: Math.min(start.x, move.clientX),
          y: Math.min(start.y, move.clientY),
          width: Math.abs(across),
          height: Math.abs(down),
        };
        const frame = room.getBoundingClientRect();
        box.style.transform = `translate(${drawn.x - frame.left}px, ${drawn.y - frame.top}px)`;
        box.style.width = `${drawn.width}px`;
        box.style.height = `${drawn.height}px`;
        box.hidden = false;
      };
      const end = () => {
        window.removeEventListener('mousemove', onMove, true);
        window.removeEventListener('mouseup', onUp, true);
        window.removeEventListener('keydown', onKey, true);
        box.hidden = true;
        stop = null;
      };
      const onUp = () => {
        const letGo = drawn;
        end();
        if (letGo === null) return;
        // The click that ends the drag is the box's, not the canvas's: it
        // would let go of what the box has just taken in hand.
        const swallow = (click: MouseEvent) => {
          click.stopPropagation();
          click.preventDefault();
        };
        window.addEventListener('click', swallow, {
          capture: true,
          once: true,
        });
        setTimeout(() => window.removeEventListener('click', swallow, true));
        latest.current.onBox(letGo);
      };
      const onKey = (key: KeyboardEvent) => {
        if (key.key === 'Escape') end();
      };
      window.addEventListener('mousemove', onMove, true);
      window.addEventListener('mouseup', onUp, true);
      window.addEventListener('keydown', onKey, true);
      stop = end;
    };
    room.addEventListener('mousedown', onDown, true);
    return () => {
      room.removeEventListener('mousedown', onDown, true);
      stop?.();
    };
  }, [within]);
  return <div ref={shown} hidden aria-hidden className={classes.box} />;
}
