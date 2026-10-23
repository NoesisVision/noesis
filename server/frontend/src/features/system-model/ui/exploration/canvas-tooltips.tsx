import { type RefObject, useEffect, useRef, useState } from 'react';
import { ElementTooltip } from '#/features/design-docs/element-reader.ts';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';

/** How long the pointer rests on a card before it says what it is, in ms. */
const ELEMENT_DELAY = 600;

/** What the canvas's tooltip says, and over what it stands. */
type Tip =
  | { kind: 'plain'; label: string; rect: DOMRect }
  | { kind: 'element'; name: string; rect: DOMRect };

const TIPPED = '[data-tip], [data-element-tip]';

/*
 * The canvas's one tooltip, for every card on it: a button names its own in
 * `data-tip`, and a card's element in `data-element-tip`, said after a rest
 * — a pointer crosses cards on its way about the canvas. A card then holds
 * no tooltip of its own, so drawing it again is cheap, and the canvas
 * listens once for all of them. It opens on hover or focus, and shuts when
 * the pointer leaves, presses, scrolls or opens a menu, and for as long as
 * a card is dragged.
 */
export function CanvasTooltips({
  within,
  dragging,
}: {
  within: RefObject<HTMLElement | null>;
  dragging: boolean;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const held = useRef(dragging);
  const shut = useRef<() => void>(() => {});
  useEffect(() => {
    held.current = dragging;
    if (dragging) shut.current();
  }, [dragging]);

  useEffect(() => {
    const root = within.current;
    if (root === null) return;
    let over: Element | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hide = () => {
      clearTimeout(timer);
      over = null;
      setTip(null);
    };
    shut.current = hide;
    const show = (event: Event) => {
      if (held.current) return;
      const target =
        event.target instanceof Element ? event.target.closest(TIPPED) : null;
      if (target === over) return;
      if (target === null || !root.contains(target)) return hide();
      clearTimeout(timer);
      over = target;
      setTip(null);
      const label = target.getAttribute('data-tip');
      if (label !== null)
        return setTip({
          kind: 'plain',
          label,
          rect: target.getBoundingClientRect(),
        });
      const name = target.getAttribute('data-element-tip') ?? '';
      timer = setTimeout(
        () =>
          setTip({
            kind: 'element',
            name,
            rect: target.getBoundingClientRect(),
          }),
        ELEMENT_DELAY,
      );
    };
    root.addEventListener('pointerover', show);
    root.addEventListener('focusin', show);
    root.addEventListener('pointerleave', hide);
    root.addEventListener('focusout', hide);
    // Before the canvas or a menu takes the press.
    root.addEventListener('pointerdown', hide, true);
    root.addEventListener('contextmenu', hide, true);
    root.addEventListener('wheel', hide, { passive: true });
    return () => {
      clearTimeout(timer);
      root.removeEventListener('pointerover', show);
      root.removeEventListener('focusin', show);
      root.removeEventListener('pointerleave', hide);
      root.removeEventListener('focusout', hide);
      root.removeEventListener('pointerdown', hide, true);
      root.removeEventListener('contextmenu', hide, true);
      root.removeEventListener('wheel', hide);
    };
  }, [within]);

  if (tip === null) return null;
  // Where the hovered control stands, for the tooltip to point at.
  const anchor = (
    <span
      aria-hidden
      style={{
        position: 'fixed',
        left: tip.rect.left,
        top: tip.rect.top,
        width: tip.rect.width,
        height: tip.rect.height,
        pointerEvents: 'none',
      }}
    />
  );
  return tip.kind === 'plain' ? (
    <Tooltip label={tip.label} opened>
      {anchor}
    </Tooltip>
  ) : (
    <ElementTooltip name={tip.name} opened openDelay={0}>
      {anchor}
    </ElementTooltip>
  );
}
