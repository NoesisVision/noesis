import { IconDots, IconPlus, IconX } from '@tabler/icons-react';
import {
  Handle,
  type Node,
  type NodeProps,
  Position,
  useReactFlow,
  useStoreApi,
} from '@xyflow/react';
import { type MouseEvent, type PointerEvent, useState } from 'react';
import { KindIcon } from '#/features/design-docs/element-reader.ts';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Menu } from '#/shared/design-system/menu.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { IconFrameX } from '#/shared/ui/icons/icons.ts';
import {
  addressOf,
  CHAIN_DEPTH,
  CHAIN_REACHES,
  type ChainReach,
  chainOf,
  type DrawnElement,
  groupLabelOf,
  kindWordOf,
  type Reach,
  REACHES,
  relationOfChain,
} from '../../system-model-exploration.ts';
import { useCardActions, useSelectionState } from './exploration-reading.ts';
import type { LayoutDirection, PlacedElement } from './layout-exploration.ts';
import type { CanvasPoint } from './place-locally.ts';
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
 * is in its own menu.
 */

export type ExplorationNode = Node<{
  placed: PlacedElement;
  direction: LayoutDirection;
  /** Taken off the diagram, and drawn a moment longer to leave it. */
  leaving?: boolean;
}>;

/** What the round button says it brings, of how many. */
const containsLabel = (name: string, count: number) =>
  `Show ${count === 1 ? 'the element' : `the ${count} elements`} ${name} contains`;

/** What the element still reaches that is not drawn, by each way it does. */
function useMissing(id: string) {
  const { drawn, neighbours } = useCardActions();
  const reach = neighbours.get(id);
  if (reach === undefined) return null;
  return REACHES.map((each) => ({
    each,
    missing: reach[each].filter((other) => !drawn.has(other)),
  })).filter(({ missing }) => missing.length > 0);
}

/** What the way to tidy up a frame says, in its corner and in its menu. */
const TIDY_UP = 'Tidy up inside';

/*
 * On the middle of the bottom border of the card, or the frame, in its
 * colours, so it plainly belongs to that box: what it contains that is not
 * drawn yet, as a small round plus. It opens a menu of them: all at once
 * first, then each by name and
 * kind. What it contains, once on the diagram inside it, is arranged there.
 */
function Contains({
  element,
  holds,
}: {
  element: DrawnElement;
  holds: boolean;
}) {
  const { id, name } = element;
  const contains = useMissing(id)?.find(({ each }) => each === 'contains');
  // Held here, so the button can say so: the menu's own word on it.
  const [open, setOpen] = useState(false);
  if (contains === undefined) return null;
  const { missing } = contains;
  const label = containsLabel(name, missing.length);
  return (
    <Menu
      opened={open}
      onChange={setOpen}
      position="bottom"
      shadow="md"
      withinPortal
      // The canvas stops a mouse press from reaching the page; a pointer's does.
      clickOutsideEvents={['pointerdown']}
    >
      <Menu.Target>
        <UnstyledButton
          className={`nodrag nopan ${classes.contains}`}
          data-frame={holds || undefined}
          data-kind={element.kind}
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <IconPlus size={12} stroke={2.4} aria-hidden />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown
        className={`nowheel ${classes.reachMenu}`}
        onContextMenu={keepInMenu}
      >
        <Menu.Label>Contains:</Menu.Label>
        <ReachItems id={id} reach="contains" missing={missing} />
      </Menu.Dropdown>
    </Menu>
  );
}

/** Puts others on the diagram beside the card; what it contains, arranged inside it. */
function useAdd(id: string, reach: Reach, at: CanvasPoint | null = null) {
  const { onShow } = useCardActions();
  // Asked for at a point in a frame, what it contains goes round that point,
  // and the frame is left as it is laid out.
  return (ids: string[]) =>
    at !== null && reach === 'contains'
      ? onShow(ids, true, id, false, at)
      : onShow(ids, true, id, reach === 'contains');
}

/** What a reach's menu offers: all of them at once, when more than one, then each by name and kind. */
function ReachItems({
  id,
  reach,
  missing,
  at = null,
}: {
  id: string;
  reach: Reach;
  missing: string[];
  /** Where on the canvas they were asked for, if anywhere. */
  at?: CanvasPoint | null;
}) {
  const { elements } = useCardActions();
  const add = useAdd(id, reach, at);
  return (
    <>
      {/* With one, the element itself is all there is to pick. */}
      {missing.length > 1 && (
        <>
          <Menu.Item
            leftSection={<IconPlus size={14} stroke={1.8} aria-hidden />}
            onClick={() => add(missing)}
          >
            {`Add all ${missing.length}`}
          </Menu.Item>
          <Menu.Divider />
        </>
      )}
      {missing.map((other) => {
        const element = elements.get(other);
        if (element === undefined) return null;
        return (
          <Menu.Item
            key={other}
            // As the model's tree draws it, so the two read alike.
            leftSection={
              <KindIcon
                kind={element.kind}
                pattern={element.pattern}
                size={16}
              />
            }
            onClick={() => add([other])}
          >
            <Text component="span" fz="sm" display="block" truncate>
              {element.name}
            </Text>
            <Text
              component="span"
              fz="xs"
              display="block"
              c="var(--noesis-secondary-text)"
            >
              {groupLabelOf(element.pattern ?? element.kind)}
            </Text>
          </Menu.Item>
        );
      })}
    </>
  );
}

/**
 * A right click in a menu stays there: the menu is the card's in React's
 * tree, wherever it is drawn, so it would open the card's own menu too.
 */
const keepInMenu = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

/** What each way reaches step after step, up to its own type or the depth, that is not drawn. */
function useChains(id: string) {
  const { drawn, neighbours, elements } = useCardActions();
  return CHAIN_REACHES.map((each) => ({
    each,
    missing: chainOf(neighbours, elements, id, each).filter(
      (other) => !drawn.has(other),
    ),
  })).filter(({ missing }) => missing.length > 0);
}

/**
 * A chain followed: all it reaches, beside the card, with the edges of its
 * relation drawn so the chain reads as one.
 */
function ChainEntry({
  id,
  reach,
  missing,
}: {
  id: string;
  reach: ChainReach;
  missing: string[];
}) {
  const { onShow, onDraw } = useCardActions();
  return (
    <Menu.Item
      onClick={() => {
        onDraw(relationOfChain(reach));
        onShow(missing, true, id);
      }}
    >
      {`${REACH_ACTION[reach]}: ${missing.length}`}
    </Menu.Item>
  );
}

/** What the card's own menu calls each way, under its "Add" heading. */
const REACH_ACTION = {
  contains: 'Contains',
  isPartOf: 'Part of',
  uses: 'Uses',
  usedBy: 'Used by',
  invokes: 'Invokes',
  invokedBy: 'Invoked by',
} as const satisfies Record<Reach, string>;

/*
 * The card's own menu, from a right click on it or its dots: each way it
 * reaches others not yet drawn, opening onto them as its button's menu
 * does; its one parent, brought at once.
 */
function NodeMenuDropdown({
  id,
  name,
  holds,
  at = null,
}: {
  id: string;
  name: string;
  holds: boolean;
  /** Where on the canvas a frame was right-clicked, for what it contains to go. */
  at?: CanvasPoint | null;
}) {
  const { onArrange, elements } = useCardActions();
  const missing = useMissing(id) ?? [];
  const chains = useChains(id);
  const element = elements.get(id);
  return (
    <Menu.Dropdown
      className={`nowheel ${classes.nodeMenu}`}
      onContextMenu={keepInMenu}
    >
      {/* Whose menu it is, set apart from what it offers. */}
      <Menu.Label className={classes.nodeMenuTitle}>{name}</Menu.Label>
      <Menu.Divider />
      {/* A frame's own first: setting out again what it holds. */}
      {holds && (
        <>
          <Menu.Item onClick={() => onArrange(id)}>{TIDY_UP}</Menu.Item>
          <Menu.Divider />
        </>
      )}
      <Menu.Label>Add</Menu.Label>
      {missing.length === 0 && chains.length === 0 && (
        <Menu.Item disabled>Nothing more to add</Menu.Item>
      )}
      {missing.map(({ each, missing: them }) => (
        <NodeMenuEntry key={each} id={id} reach={each} missing={them} at={at} />
      ))}
      {/* Each way followed through all it reaches, up to the next of its type. */}
      {chains.length > 0 && element !== undefined && (
        <>
          <Menu.Divider />
          <Menu.Label>
            {`Follow up to the next ${groupLabelOf(element.pattern ?? element.kind)}, ${CHAIN_DEPTH} steps at most`}
          </Menu.Label>
          {chains.map(({ each, missing: them }) => (
            <ChainEntry key={each} id={id} reach={each} missing={them} />
          ))}
        </>
      )}
    </Menu.Dropdown>
  );
}

function NodeMenuEntry({
  id,
  reach,
  missing,
  at,
}: {
  id: string;
  reach: Reach;
  missing: string[];
  at: CanvasPoint | null;
}) {
  const add = useAdd(id, reach, at);
  if (reach === 'isPartOf' && missing.length === 1)
    return (
      <Menu.Item onClick={() => add(missing)}>
        {`${REACH_ACTION[reach]}: 1`}
      </Menu.Item>
    );
  return (
    <Menu.Sub>
      <Menu.Sub.Target>
        <Menu.Sub.Item>
          {`${REACH_ACTION[reach]}: ${missing.length}`}
        </Menu.Sub.Item>
      </Menu.Sub.Target>
      <Menu.Sub.Dropdown className={`nowheel ${classes.reachMenu}`}>
        <ReachItems id={id} reach={reach} missing={missing} at={at} />
      </Menu.Sub.Dropdown>
    </Menu.Sub>
  );
}

/** Where the card's own menu opens: at the pointer, or under its dots. */
const NODE_MENU = {
  shadow: 'md',
  withinPortal: true,
  position: 'bottom-start',
  // The canvas stops a mouse press from reaching the page; a pointer's does.
  clickOutsideEvents: ['pointerdown'] as string[],
} as const;

/** The card's dots, in its corner beside the way off: its own menu. */
function NodeMenuButton({
  id,
  name,
  holds,
}: {
  id: string;
  name: string;
  holds: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Menu opened={open} onChange={setOpen} {...NODE_MENU}>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label={`More for ${name}`}
          data-tip="All actions · also on right-click"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <IconDots size={14} stroke={1.8} aria-hidden />
        </ActionIcon>
      </Menu.Target>
      <NodeMenuDropdown id={id} name={name} holds={holds} />
    </Menu>
  );
}

/*
 * In the top right corner: the card's own menu, and apart from it the way
 * off the diagram — a card's one cross; a frame's two, the cross taking
 * only the frame, what it held staying where it stands, and the frame
 * crossed out taking it with everything inside.
 */
function Remove({
  id,
  name,
  holds,
}: {
  id: string;
  name: string;
  holds: boolean;
}) {
  const { onShow, onRemoveAlone } = useCardActions();
  return (
    <div className={`nodrag nopan ${classes.corner}`}>
      {/* Apart from the ways off, so a click meant for it never takes one. */}
      <div className={classes.strip}>
        <NodeMenuButton id={id} name={name} holds={holds} />
      </div>
      <div className={classes.strip}>
        {holds && (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            className={classes.remove}
            aria-label={`Remove ${name} and what it holds from the view`}
            data-tip="Remove group"
            onClick={() => onShow([id], false, id)}
          >
            <IconFrameX size={14} stroke={1.8} aria-hidden />
          </ActionIcon>
        )}
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          className={classes.remove}
          aria-label={
            holds
              ? `Remove only ${name}, keeping what it holds`
              : `Remove ${name} from the view`
          }
          data-tip={holds ? 'Remove only this' : 'Remove from the view'}
          onClick={() => (holds ? onRemoveAlone(id) : onShow([id], false, id))}
        >
          <IconX size={14} stroke={1.8} aria-hidden />
        </ActionIcon>
      </div>
    </div>
  );
}

/** How far a pointer may move between press and release and still be a click. */
const CLICK_SLOP = 4;

/*
 * A frame's room for what it holds is the canvas's, to the reader: pressed
 * and dragged, it moves the view, and double-clicked it zooms in round the
 * pointer, as the empty canvas does. React Flow keeps both from a node it
 * drags, frames included, though a frame is dragged by its top alone; so
 * they are done here, on the room itself and nothing in it.
 */
function useViewingFromFrame(onLetGo: () => void) {
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
      // that lets go of the selection, as a click on the empty canvas does.
      if (
        to.type === 'pointerup' &&
        Math.hypot(to.clientX - from.x, to.clientY - from.y) < CLICK_SLOP
      )
        onLetGo();
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

export function ElementNode({ data }: NodeProps<ExplorationNode>) {
  const { element, holds } = data.placed;
  const { state, onSelect, onLetGo } = useSelectionState(element.id);
  const [menu, setMenu] = useState(false);
  // Where a frame was right-clicked, on the canvas.
  const [at, setAt] = useState<CanvasPoint | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  const viewing = useViewingFromFrame(onLetGo);
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
      className={holds ? classes.containerLabel : classes.card}
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
      {/* A value object's bevelled face, drawn under its name: its edge is
          the card's own layer, as a cut corner cannot carry a border. */}
      {!holds && element.pattern === 'value_object' && (
        <span className={classes.face} aria-hidden />
      )}
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
          data-kind={element.kind}
          data-pattern={element.pattern}
          data-state={holds ? state : undefined}
          data-leaving={data.leaving || undefined}
        >
          {/* Where React Flow has an edge start and end; the edge itself
              meets the card wherever the line between them crosses its
              border (relation-edge.tsx). */}
          <Handle
            type="target"
            position={into}
            isConnectable={false}
            className={classes.handle}
          />
          {/* A frame is taken by its top, where its name is: the rest is
              room for what it holds. */}
          {holds ? <div className={classes.frameTop}>{button}</div> : button}
          <Contains element={element} holds={holds} />
          <Remove id={element.id} name={element.name} holds={holds} />
          <Handle
            type="source"
            position={outOf}
            isConnectable={false}
            className={classes.handle}
          />
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
