import { type ComponentProps, type ReactNode, useRef, useState } from 'react';
import { Menu } from '#/shared/design-system/menu.tsx';
import { useCardActions } from './exploration-reading.ts';
import type { CanvasPoint } from './place-locally.ts';
import { NODE_MENU, NodeMenuDropdown } from './reach-menu.tsx';
import { hasNodeMenu } from './use-reaches.ts';
import classes from './exploration.module.css';

/*
 * A card's own menu, where it is right-clicked or pressed long: one menu
 * for the whole canvas, as its tooltip is one (canvas-tooltips.tsx), so a
 * card holds none. The canvas is what is pressed; which card the press
 * was on is read from the page, and the menu is that card's. A press on
 * the empty canvas, or on what floats over it, is not the menu's at all.
 */

/** The card a menu is for, and — a frame — where on the canvas it was asked for. */
interface MenuCard {
  id: string;
  name: string;
  holds: boolean;
  at: CanvasPoint | null;
}

/** A point on the page, as a pointer or a touch gives it. */
interface PagePoint {
  clientX: number;
  clientY: number;
}

/** What the menu's own handling of a press takes, handed on only for a card. */
type Presses = Pick<
  ComponentProps<'div'>,
  | 'onContextMenu'
  | 'onMouseDown'
  | 'onTouchStart'
  | 'onTouchEnd'
  | 'onTouchCancel'
  | 'onTouchMove'
>;

export function CardContextMenu({
  toCanvas,
  children,
}: {
  /** Where a point of the page is on the canvas; null until the canvas is there. */
  toCanvas: ((point: { x: number; y: number }) => CanvasPoint) | null;
  children: ReactNode;
}) {
  const reading = useCardActions();
  const [card, setCard] = useState<MenuCard | null>(null);
  const [open, setOpen] = useState(false);
  // The card last pressed on: the menu's, once the press opens it.
  const pressed = useRef<MenuCard | null>(null);
  /** The card a press is on: one with a menu to open, one with none, or no card. */
  const press = (target: EventTarget, at: PagePoint) => {
    const node =
      target instanceof Element ? target.closest('.react-flow__node') : null;
    const id = node?.getAttribute('data-id') ?? null;
    const element = id === null ? undefined : reading.elements.get(id);
    if (node === null || id === null || element === undefined)
      return 'elsewhere';
    const holds = node.querySelector('[data-part="container"]') !== null;
    if (!hasNodeMenu(id, holds, reading)) return 'bare';
    pressed.current = {
      id,
      name: element.name,
      holds,
      // What a frame is asked to bring in goes round where it was asked.
      at:
        holds && toCanvas !== null
          ? toCanvas({ x: at.clientX, y: at.clientY })
          : null,
    };
    return 'card';
  };
  return (
    <Menu
      opened={open && card !== null}
      onChange={(now) => {
        if (now) setCard(pressed.current);
        setOpen(now);
      }}
      {...NODE_MENU}
    >
      <Menu.ContextMenu>
        <Cards onPress={press}>{children}</Cards>
      </Menu.ContextMenu>
      {card !== null && (
        <NodeMenuDropdown
          id={card.id}
          name={card.name}
          holds={card.holds}
          at={card.at}
        />
      )}
    </Menu>
  );
}

/**
 * The canvas, as what the menu is opened on. The menu hands it its own
 * handling of a right click and of a long press; each is passed on only
 * when the press is on a card with a menu to open.
 */
function Cards({
  onPress,
  children,
  onContextMenu,
  onMouseDown,
  onTouchStart,
  onTouchEnd,
  onTouchCancel,
  onTouchMove,
}: Presses & {
  onPress: (
    target: EventTarget,
    at: PagePoint,
  ) => 'card' | 'bare' | 'elsewhere';
  children: ReactNode;
}) {
  // Whether the touch under way began on a card with a menu.
  const touching = useRef(false);
  return (
    // Nothing of its own to a reader: the presses it hears are the cards'.
    <div
      role="presentation"
      className={classes.cards}
      onContextMenu={(event) => {
        const on = onPress(event.target, event);
        // The canvas's own menu, or the page's.
        if (on === 'elsewhere') return;
        // A card with nothing to offer opens no menu, the browser's neither.
        if (on === 'bare') return event.preventDefault();
        onContextMenu?.(event);
      }}
      onMouseDown={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('.react-flow__node') !== null
        )
          onMouseDown?.(event);
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        touching.current =
          touch !== undefined && onPress(event.target, touch) === 'card';
        if (touching.current) onTouchStart?.(event);
      }}
      onTouchMove={(event) => {
        if (touching.current) onTouchMove?.(event);
      }}
      onTouchEnd={(event) => {
        if (touching.current) onTouchEnd?.(event);
      }}
      onTouchCancel={(event) => {
        if (touching.current) onTouchCancel?.(event);
      }}
    >
      {children}
    </div>
  );
}
