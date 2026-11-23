import { type NodeProps, Position } from '@xyflow/react';
import { type CSSProperties, memo, useContext, useRef } from 'react';
import { KindIcon } from '#/features/design-docs/element-reader.ts';
import { Box } from '#/shared/design-system/box.tsx';
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
import { nameWidthOf, paddingOf } from './layout-exploration.ts';
import { Contains, Remove } from './node-controls.tsx';
import { hiddenSlotsWord, SLOT_GROUPS } from './reach-words.ts';
import { SlotBadges } from './slot-badges.tsx';
import { CLICK_SLOP, useViewingFromFrame } from './use-viewing-from-frame.ts';
import classes from './exploration.module.css';

/*
 * What React Flow draws for an element: a card with its name, the icon of
 * its kind before it, or — when others are drawn inside it — a frame with
 * both at its top. The card, or the frame's name, is a button that selects
 * the element, and hovered or focused says what the element is — its kind
 * in a word, which the card leaves to its icon — as the model's tooltips do.
 * Its tooltips are the canvas's one (see `CanvasTooltips`), each button
 * naming its own in `data-tip`, so a card holds none of its own.
 * Edges come in where the layout's flow does and leave the other side.
 * Inside, it always shows its own menu and the way off the diagram, in its
 * corner — a frame's way to tidy up what it holds is in that menu; and at
 * the middle of its bottom, a round button for what it contains, the card
 * made taller for it only when it has one. All else it can bring beside it
 * is in its own menu. Its slots are badges under its name, the card — or
 * the frame's top — as tall as they need.
 *
 * A diagram draws many of these, so a card is kept light: its tooltips,
 * and its menu on a right click, are the canvas's one of each
 * (canvas-tooltips.tsx, card-context-menu.tsx), and what opens from its
 * buttons is drawn once first asked for (use-lazy-opening.ts).
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

/**
 * The node React Flow draws. It is handed where the node stands on the
 * canvas, which changes with every move of a frame it is drawn inside; the
 * card reads none of that, so it is given only what it shows, and is not
 * drawn again as it — or a frame round it — is dragged.
 */
export function ElementNode({
  data,
  width,
  height,
}: NodeProps<ExplorationNode>) {
  return <ElementCard data={data} width={width} height={height} />;
}

const ElementCard = memo(function ElementCard({
  data,
  width,
  height,
}: Pick<NodeProps<ExplorationNode>, 'data' | 'width' | 'height'>) {
  const { element, holds } = data.placed;
  // Its shape, as every diagram draws an element (diagram-shapes.tsx).
  const shape = holds ? undefined : shapeOf(element.kind, element.pattern);
  const bevelled = shape === 'bevel';
  const { state, onSelect } = useSelectionState(element.id);
  const { badges, noOutput, stepping, onInto, slotsHidden } = useContext(
    ExplorationReadingContext,
  );
  // The groups of its slots the reader hid on it, said in its name for a
  // reader who cannot see the way to show them in its corner.
  const hid = SLOT_GROUPS.filter((group) => slotsHidden[group].has(element.id));
  // From further off its name clicked, or its frame double-clicked, goes
  // into it: the middle of the canvas, and closer (exploration-view.tsx).
  const goInto = () => onInto(element.id);
  const carried = badges.get(element.id) ?? [];
  // A behavior that gives nothing back has a signature to say so.
  const givesNothing = noOutput.has(element.id);
  const badged = carried.length > 0 || givesNothing;
  // A frame clicked anywhere, not dragged, is taken in hand: its room here,
  // its top below.
  const select = (adding: boolean) => onSelect(element.id, adding);
  const viewing = useViewingFromFrame(select, goInto);
  const pressedTop = useRef<{ x: number; y: number } | null>(null);
  // Its kind as the model's tree draws it, before its name: cut short
  // where it runs out of room, but for a behavior's, which never is.
  const label = (
    <span className={classes.nameLine}>
      <KindIcon kind={element.kind} pattern={element.pattern} size={16} />
      <Text
        component="span"
        className={classes.name}
        fz="sm"
        fw={600}
        truncate={element.kind !== 'behavior'}
      >
        {element.name}
      </Text>
    </span>
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
      aria-label={withState(
        `${element.name}, ${kindWordOf(element)}${hid.length > 0 ? `, ${hiddenSlotsWord(hid)} hidden` : ''}`,
        state,
      )}
      // What the element is, said by the canvas's one tooltip on hover:
      // where it sits, and its kind in a word.
      data-element-tip={addressOf(element.id)}
      data-element-kind={groupLabelOf(element.pattern ?? element.kind)}
      // Ctrl, or Cmd on a Mac, adds it to the hand or takes it out. From
      // further off a plain click goes into it instead, closer.
      onClick={(event) => {
        const adding = event.ctrlKey || event.metaKey;
        if (adding || !goInto()) onSelect(element.id, adding);
      }}
    >
      {/* A bevelled card's face, drawn under its name: its edge is the
          card's own layer, as a cut corner cannot carry a border. */}
      {bevelled && <BevelFace />}
      {label}
    </UnstyledButton>
  );
  return (
    <Box
      {...(holds ? viewing : {})}
      className={holds ? classes.container : classes.holder}
      data-part={holds ? 'container' : 'holder'}
      data-kind={element.kind}
      data-pattern={element.pattern}
      data-state={holds ? state : undefined}
      // Where it stands to the selection; with none, it steps back
      // while something is in hand (exploration.module.css).
      data-standing={state}
      data-leaving={data.leaving || undefined}
      data-badged={badged || undefined}
      // From how far off it steps back, or — a frame — holds only what
      // has (exploration-detail.ts); and whether it is drawn inside a
      // frame, where it is not moved from that far.
      data-stepped-back-from={stepping.steppedBackFrom.get(element.id)}
      data-hollow-from={stepping.hollowFrom.get(element.id)}
      data-nested={element.parent !== null || undefined}
      // What its name is sized against from further off
      // (exploration.module.css): its own width, and the room it has.
      style={
        {
          '--name-width': nameWidthOf(element.name),
          '--frame-width': width ?? data.placed.width,
          '--frame-height': height ?? data.placed.height,
        } as CSSProperties
      }
    >
      {/* Where React Flow has an edge start and end; the edge itself
              meets the card wherever the line between them crosses its
              border (shared/ui/diagram-canvas/floating-edge.tsx). */}
      <HiddenHandle type="target" position={Position.Top} />
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
                  '--frame-top': `${paddingOf(element, { badges, noOutput }).top}px`,
                } as CSSProperties)
              : undefined
          }
          // Its top is what drags the frame: let go where it was pressed,
          // it was a click. What is on it — its name, menu, crosses —
          // answers for itself; its name is the keyboard's way to the
          // same, so the strip round it is the pointer's alone.
          // A module with only what stepped back inside it is all top.
          onDoubleClick={(event) => {
            if (event.target === event.currentTarget) goInto();
          }}
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
      <SlotBadges badges={carried} noOutput={givesNothing} frame={holds} />
      {bevelled && state === 'related' && (
        <BevelRing
          width={width ?? data.placed.width}
          height={height ?? data.placed.height}
        />
      )}
      <Contains element={element} holds={holds} />
      <Remove id={element.id} name={element.name} holds={holds} />
      <HiddenHandle type="source" position={Position.Bottom} />
    </Box>
  );
});
