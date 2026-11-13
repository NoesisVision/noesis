import { type NodeProps, Position, useReactFlow } from '@xyflow/react';
import {
  type CSSProperties,
  type MouseEvent,
  useContext,
  useRef,
  useState,
} from 'react';
import { KindIcon } from '#/features/design-docs/element-reader.ts';
import { Box } from '#/shared/design-system/box.tsx';
import { Menu } from '#/shared/design-system/menu.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { addressOf } from '#/shared/model/element-id.ts';
import { HiddenHandle } from '#/shared/ui/diagram-canvas/hidden-handle.tsx';
import {
  BevelFace,
  BevelRing,
  cardShapeClass,
  shapeOf,
} from '#/shared/ui/diagram-shapes.tsx';
import { groupLabelOf, kindWordOf } from '../../system-model-exploration.ts';
import { type ExplorationNode } from './exploration-node.ts';
import {
  ExplorationReadingContext,
  useSelectionState,
} from './exploration-reading.ts';
import { paddingOf } from './layout-exploration.ts';
import { Contains, Remove } from './node-controls.tsx';
import type { CanvasPoint } from './place-locally.ts';
import { NODE_MENU, NodeMenuDropdown } from './reach-menu.tsx';
import { SlotBadges } from './slot-badges.tsx';
import { CLICK_SLOP, useViewingFromFrame } from './use-viewing-from-frame.ts';
import classes from './exploration.module.css';

/*
 * What React Flow draws for an element: a card with its name and what it
 * is, or — when others are drawn inside it — a frame with both at its top.
 * The card, or the frame's name, is a button that selects the element, and
 * hovered or focused says what the element is, as the model's tooltips do.
 * Its tooltips are the canvas's one (see `CanvasTooltips`), each button
 * naming its own in `data-tip`, so a card holds none of its own.
 * Edges come in where the layout's flow does and leave the other side.
 * Inside, it always shows its own menu and the way off the diagram, in its
 * corner — a frame's way to tidy up what it holds is in that menu; and at
 * the middle of its bottom, a round button for what it contains, the card
 * made taller for it only when it has one. All else it can bring beside it
 * is in its own menu. With slots on cards, its slots are badges under its
 * name, the card — or the frame's top — as tall as they need.
 */

export * from './exploration-node.ts';
export * from './reach-words.ts';
export * from './use-reaches.ts';
export * from './reach-menu.tsx';
export * from './node-controls.tsx';
export * from './use-viewing-from-frame.ts';

/** What a card is to the selection, for a reader who cannot see its border. */
const withState = (
  label: string,
  state: 'selected' | 'related' | 'path' | undefined,
) =>
  state === 'related'
    ? `${label}, related to the selection`
    : state === 'path'
      ? `${label}, holds the selection`
      : label;

export function ElementNode({
  data,
  width,
  height,
}: NodeProps<ExplorationNode>) {
  const { element, holds } = data.placed;
  // Its shape, as every diagram draws an element (diagram-shapes.tsx).
  const shape = holds ? undefined : shapeOf(element.kind, element.pattern);
  const bevelled = shape === 'bevel';
  const { state, dimmed, onSelect } = useSelectionState(element.id);
  const { badges } = useContext(ExplorationReadingContext);
  const carried = badges.get(element.id) ?? [];
  const badged = carried.length > 0;
  const [menu, setMenu] = useState(false);
  // Where a frame was right-clicked, on the canvas.
  const [at, setAt] = useState<CanvasPoint | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  // A frame clicked anywhere, not dragged, is taken in hand: its room here,
  // its top below.
  const select = (adding: boolean) => onSelect(element.id, adding);
  const viewing = useViewingFromFrame(select);
  const pressedTop = useRef<{ x: number; y: number } | null>(null);
  const [into, outOf] =
    data.direction === 'vertical'
      ? [Position.Top, Position.Bottom]
      : [Position.Left, Position.Right];
  const label = (
    <>
      {/* Its kind as the model's tree draws it, before its name. */}
      <span className={classes.nameLine}>
        <KindIcon kind={element.kind} pattern={element.pattern} size={16} />
        <Text component="span" fz="sm" fw={600} truncate>
          {element.name}
        </Text>
      </span>
      <Text component="span" fz="xs" c="var(--noesis-secondary-text)" truncate>
        {groupLabelOf(element.pattern ?? element.kind)}
      </Text>
    </>
  );
  const button = (
    <UnstyledButton
      className={
        holds ? classes.containerLabel : `${classes.card} ${cardShapeClass}`
      }
      data-shape={shape}
      // How a diagram theme (themes/) reaches it, as it cannot name the class.
      data-part={holds ? 'frame-label' : 'card'}
      data-kind={element.kind}
      data-pattern={element.pattern}
      data-state={holds ? undefined : state}
      aria-pressed={state === 'selected'}
      aria-label={withState(`${element.name}, ${kindWordOf(element)}`, state)}
      // What the element is, said by the canvas's one tooltip on hover.
      data-element-tip={addressOf(element.id)}
      // Ctrl, or Cmd on a Mac, adds it to the hand or takes it out.
      onClick={(event) => onSelect(element.id, event.ctrlKey || event.metaKey)}
    >
      {/* A bevelled card's face, drawn under its name: its edge is the
          card's own layer, as a cut corner cannot carry a border. */}
      {bevelled && <BevelFace />}
      {label}
    </UnstyledButton>
  );
  return (
    // A right click on the card, or a long press, opens its own menu there.
    <Menu opened={menu} onChange={setMenu} {...NODE_MENU}>
      <Menu.ContextMenu>
        <Box
          onContextMenu={(event: MouseEvent) =>
            setAt(
              holds
                ? screenToFlowPosition({ x: event.clientX, y: event.clientY })
                : null,
            )
          }
          {...(holds ? viewing : {})}
          className={holds ? classes.container : classes.holder}
          data-part={holds ? 'container' : 'holder'}
          data-kind={element.kind}
          data-pattern={element.pattern}
          data-state={holds ? state : undefined}
          data-dimmed={dimmed || undefined}
          data-leaving={data.leaving || undefined}
          data-badged={badged || undefined}
        >
          {/* Where React Flow has an edge start and end; the edge itself
              meets the card wherever the line between them crosses its
              border (shared/ui/diagram-canvas/floating-edge.tsx). */}
          <HiddenHandle type="target" position={into} />
          {/* A frame is taken by its top, where its name is: the rest is
              room for what it holds. */}
          {holds ? (
            <Box
              className={classes.frameTop}
              data-part="frame-top"
              // As tall as its name and its badges (layout-exploration.ts).
              style={
                badged
                  ? ({
                      '--frame-top': `${paddingOf(element, badges).top}px`,
                    } as CSSProperties)
                  : undefined
              }
              // Its top is what drags the frame: let go where it was pressed,
              // it was a click. What is on it — its name, menu, crosses —
              // answers for itself; its name is the keyboard's way to the
              // same, so the strip round it is the pointer's alone.
              onPointerDown={(event) => {
                pressedTop.current =
                  event.target === event.currentTarget
                    ? { x: event.clientX, y: event.clientY }
                    : null;
              }}
              onClick={(event) => {
                const from = pressedTop.current;
                pressedTop.current = null;
                if (
                  from !== null &&
                  event.target === event.currentTarget &&
                  Math.hypot(event.clientX - from.x, event.clientY - from.y) <
                    CLICK_SLOP
                )
                  select(event.ctrlKey || event.metaKey);
              }}
            >
              {button}
            </Box>
          ) : (
            button
          )}
          <SlotBadges badges={carried} frame={holds} />
          {bevelled && state === 'related' && (
            <BevelRing
              width={width ?? data.placed.width}
              height={height ?? data.placed.height}
            />
          )}
          <Contains element={element} holds={holds} />
          <Remove id={element.id} name={element.name} holds={holds} />
          <HiddenHandle type="source" position={outOf} />
        </Box>
      </Menu.ContextMenu>
      <NodeMenuDropdown
        id={element.id}
        name={element.name}
        holds={holds}
        at={at}
      />
    </Menu>
  );
}
