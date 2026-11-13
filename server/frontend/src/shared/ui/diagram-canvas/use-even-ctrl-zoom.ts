import { type RefObject, useEffect } from 'react';

/**
 * Ctrl and the wheel zooming a canvas as slowly as Cmd and the wheel. React
 * Flow takes every wheel with Ctrl for a trackpad's pinch, which it speeds up
 * tenfold on a Mac; a pinch presses no key, so while the Ctrl key itself is
 * down the wheel is handed on as Cmd's. `frame` is the element the canvas
 * sits in.
 */
export function useEvenCtrlZoom(frame: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = frame.current;
    if (element === null) return;
    let ctrlDown = false;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Control') ctrlDown = event.type === 'keydown';
    };
    const onBlur = () => {
      ctrlDown = false;
    };
    const onWheel = (event: WheelEvent) => {
      if (!ctrlDown || !event.ctrlKey || !event.isTrusted) return;
      event.preventDefault();
      event.stopPropagation();
      event.target?.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaMode: event.deltaMode,
          clientX: event.clientX,
          clientY: event.clientY,
          screenX: event.screenX,
          screenY: event.screenY,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: true,
        }),
      );
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', onBlur);
    element.addEventListener('wheel', onWheel, {
      capture: true,
      passive: false,
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', onBlur);
      element.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, [frame]);
}
