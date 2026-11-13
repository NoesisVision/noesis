import { useEffect, useRef, useState } from 'react';
import '@xyflow/react/dist/base.css';

/*
 * The width a canvas has to lay out in, in steps, so a small resize does
 * not lay it out again.
 */

/** How finely the canvas follows its column's width, so a scrollbar coming and going does not move it. */
const WIDTH_STEP = 24;

/**
 * The width of what the ref is on, in steps, read on the frame after it
 * changes: the canvas's height follows it, and a change made while the
 * browser is still delivering the resize would loop it.
 */
export function useWidth() {
  const ref = useRef<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const measured = entry?.contentRect.width ?? 0;
        setWidth(Math.floor(measured / WIDTH_STEP) * WIDTH_STEP);
      });
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);
  return { ref, width };
}
