import { type MouseEvent, useEffect, useRef, useState } from 'react';

/*
 * A card's menu or popup, there only once it is first asked for. Each one
 * is a floating panel with its own listeners and its own place to work
 * out, and a diagram holds several to a card; most are never opened, so a
 * card draws none of them until its button is pressed. The button is the
 * card's own, drawn all along; the panel, once there, hangs on a mark
 * laid over the button (`.opening` in exploration.module.css).
 */
export function useLazyOpening(open: boolean, onOpen: (open: boolean) => void) {
  const [mounted, setMounted] = useState(false);
  // Asked for before it was there: opened once it is, so it opens as it
  // always will — shown from shut, with the focus kept to go back to.
  const asked = useRef(false);
  // Whether it was open as the button was pressed: the panel takes a press
  // on the button for one outside it, and has shut by the click.
  const pressedOpen = useRef(false);
  useEffect(() => {
    if (!mounted || !asked.current) return;
    asked.current = false;
    onOpen(true);
  }, [mounted, onOpen]);
  return {
    /** Whether the panel is drawn yet, open or shut. */
    mounted,
    /** What the button takes, to open the panel and shut it. */
    opener: {
      onPointerDown: () => {
        pressedOpen.current = open;
      },
      onClick: (event: MouseEvent) => {
        if (!mounted) {
          asked.current = true;
          setMounted(true);
          return;
        }
        // From the keyboard there was no press before the click.
        onOpen(!(event.detail === 0 ? open : pressedOpen.current));
      },
    },
  };
}
