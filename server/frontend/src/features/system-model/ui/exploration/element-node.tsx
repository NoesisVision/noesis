import {
  IconArrowLeft,
  IconArrowRight,
  IconCaretDown,
  IconDots,
  IconCornerLeftUp,
  IconPlus,
  IconX,
} from '@tabler/icons-react';
import {
  Handle,
  type Node,
  type NodeProps,
  NodeResizer,
  Position,
  useStore,
} from '@xyflow/react';
import { type MouseEvent, useState } from 'react';
import {
  ElementTooltip,
  KindIcon,
} from '#/features/design-docs/element-reader.ts';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Menu } from '#/shared/design-system/menu.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { IconBroom, IconFrameX } from '#/shared/ui/icons/icons.ts';
import {
  addressOf,
  type DrawnElement,
  groupLabelOf,
  kindWordOf,
  type Reach,
  REACHES,
} from '../../system-model-exploration.ts';
import { useCardActions, useSelectionState } from './exploration-reading.ts';
import {
  frameWidthOf,
  heightOf,
  type LayoutDirection,
  paddingOf,
  type PlacedElement,
} from './layout-exploration.ts';
import classes from './exploration.module.css';

/*
 * What React Flow draws for an element: a card with its name and what it
 * is, or — when others are drawn inside it — a frame with both at its top.
 * The card, or the frame's name, is a button that selects the element, and
 * hovered or focused says what the element is, as the model's tooltips do.
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

const REACH_ICON = {
  contains: IconCaretDown,
  isPartOf: IconCornerLeftUp,
  uses: IconArrowRight,
  usedBy: IconArrowLeft,
} as const satisfies Record<Reach, unknown>;

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
 * At the middle of the bottom of the card, or the frame: what it contains
 * that is not drawn yet, as a small round button like the one that adds to
 * the diagram, opening a menu of them: all at once first, then each by name
 * and kind. Only where the card was given room for it. What it contains,
 * once on the diagram inside it, is arranged there.
 */
function Contains({ element }: { element: DrawnElement }) {
  const { id, name } = element;
  const contains = useMissing(id)?.find(({ each }) => each === 'contains');
  // Held here, so the button can say so: the tooltip between the menu and
  // its button keeps the menu's own word on it from reaching the button.
  const [open, setOpen] = useState(false);
  if (!element.containsUndrawn || contains === undefined) return null;
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
        {/* Its tooltip only while its menu is shut, so the two never overlap. */}
        <Tooltip label={label} disabled={open}>
          <ActionIcon
            size={26}
            radius="xl"
            variant="light"
            className={`nodrag nopan ${classes.contains}`}
            aria-label={label}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <IconPlus size={16} stroke={2} aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown
        className={`nowheel ${classes.reachMenu}`}
        onContextMenu={keepInMenu}
      >
        <Menu.Label>{`What ${name} contains`}</Menu.Label>
        <ReachItems id={id} reach="contains" missing={missing} />
      </Menu.Dropdown>
    </Menu>
  );
}

/** Puts others on the diagram beside the card; what it contains, arranged inside it. */
function useAdd(id: string, reach: Reach) {
  const { onShow } = useCardActions();
  return (ids: string[]) => onShow(ids, true, id, reach === 'contains');
}

/** What a reach's menu offers: all of them at once, then each by name and kind. */
function ReachItems({
  id,
  reach,
  missing,
}: {
  id: string;
  reach: Reach;
  missing: string[];
}) {
  const { elements } = useCardActions();
  const add = useAdd(id, reach);
  return (
    <>
      <Menu.Item
        leftSection={<IconPlus size={14} stroke={1.8} aria-hidden />}
        onClick={() => add(missing)}
      >
        {missing.length === 1 ? 'Add it' : `Add all ${missing.length}`}
      </Menu.Item>
      <Menu.Divider />
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

/** What the card's own menu calls each way, in plain words. */
const REACH_ACTION = {
  contains: "Add what's inside",
  isPartOf: 'Add its parent',
  uses: 'Add what it uses',
  usedBy: 'Add what uses it',
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
}: {
  id: string;
  name: string;
  holds: boolean;
}) {
  const { onArrange } = useCardActions();
  const missing = useMissing(id) ?? [];
  return (
    <Menu.Dropdown className="nowheel" onContextMenu={keepInMenu}>
      <Menu.Label>{name}</Menu.Label>
      {/* A frame's own first: setting out again what it holds. */}
      {holds && (
        <>
          <Menu.Item
            leftSection={<IconBroom size={14} stroke={1.8} aria-hidden />}
            onClick={() => onArrange(id)}
          >
            {TIDY_UP}
          </Menu.Item>
          <Menu.Divider />
        </>
      )}
      {missing.length === 0 && (
        <Menu.Item disabled>Nothing more to add</Menu.Item>
      )}
      {missing.map(({ each, missing: them }) => (
        <NodeMenuEntry key={each} id={id} reach={each} missing={them} />
      ))}
    </Menu.Dropdown>
  );
}

function NodeMenuEntry({
  id,
  reach,
  missing,
}: {
  id: string;
  reach: Reach;
  missing: string[];
}) {
  const add = useAdd(id, reach);
  const Icon = REACH_ICON[reach];
  const icon = <Icon size={14} stroke={1.8} aria-hidden />;
  if (reach === 'isPartOf' && missing.length === 1)
    return (
      <Menu.Item leftSection={icon} onClick={() => add(missing)}>
        {REACH_ACTION[reach]}
      </Menu.Item>
    );
  return (
    <Menu.Sub>
      <Menu.Sub.Target>
        <Menu.Sub.Item leftSection={icon}>
          {REACH_ACTION[reach]}{' '}
          <span className={classes.reachCount}>{missing.length}</span>
        </Menu.Sub.Item>
      </Menu.Sub.Target>
      <Menu.Sub.Dropdown className={`nowheel ${classes.reachMenu}`}>
        <ReachItems id={id} reach={reach} missing={missing} />
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
  clickOutsideEvents: ['pointerdown'],
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
        <Tooltip label="All actions · also on right-click" disabled={open}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={`More for ${name}`}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <IconDots size={14} stroke={1.8} aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <NodeMenuDropdown id={id} name={name} holds={holds} />
    </Menu>
  );
}

/**
 * The least a frame may be resized to: round what it holds, as dragged,
 * and wide enough for its name beside the cross.
 */
function useFrameMinimum(element: DrawnElement) {
  const { id, name } = element;
  const reach = useStore((state) => {
    let right = 0;
    let bottom = 0;
    for (const node of state.nodes)
      if (node.parentId === id) {
        right = Math.max(right, node.position.x + (node.width ?? 0));
        bottom = Math.max(bottom, node.position.y + (node.height ?? 0));
      }
    return `${right} ${bottom}`;
  });
  const [right = 0, bottom = 0] = reach.split(' ').map(Number);
  const padding = paddingOf(element);
  return {
    minWidth: Math.max(frameWidthOf(name), right + padding.right),
    minHeight: Math.max(heightOf(element), bottom + padding.bottom),
  };
}

/** Handles round a frame in hand, to make it larger or smaller. */
function FrameResizer({
  element,
  shown,
}: {
  element: DrawnElement;
  shown: boolean;
}) {
  const { minWidth, minHeight } = useFrameMinimum(element);
  return (
    <NodeResizer
      isVisible={shown}
      minWidth={minWidth}
      minHeight={minHeight}
      lineClassName={classes.resizeLine}
      handleClassName={classes.resizeHandle}
    />
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
          <Tooltip label="Remove group">
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              aria-label={`Remove ${name} and what it holds from the view`}
              onClick={() => onShow([id], false, id)}
            >
              <IconFrameX size={14} stroke={1.8} aria-hidden />
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip label={holds ? 'Remove only this' : 'Remove from the view'}>
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            aria-label={
              holds
                ? `Remove only ${name}, keeping what it holds`
                : `Remove ${name} from the view`
            }
            onClick={() =>
              holds ? onRemoveAlone(id) : onShow([id], false, id)
            }
          >
            <IconX size={14} stroke={1.8} aria-hidden />
          </ActionIcon>
        </Tooltip>
      </div>
    </div>
  );
}

/** What a card is to the selection, for a reader who cannot see its border. */
const withState = (label: string, state: 'selected' | 'related' | undefined) =>
  state === 'related' ? `${label}, related to the selection` : label;

export function ElementNode({ data }: NodeProps<ExplorationNode>) {
  const { element, holds } = data.placed;
  const { state, onSelect } = useSelectionState(element.id);
  const [menu, setMenu] = useState(false);
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
      data-state={holds ? undefined : state}
      aria-pressed={state === 'selected'}
      aria-label={withState(`${element.name}, ${kindWordOf(element)}`, state)}
      // Ctrl, or Cmd on a Mac, adds it to the hand or takes it out.
      onClick={(event) => onSelect(element.id, event.ctrlKey || event.metaKey)}
    >
      {label}
    </UnstyledButton>
  );
  return (
    // A right click on the card, or a long press, opens its own menu there.
    <Menu opened={menu} onChange={setMenu} {...NODE_MENU}>
      <Menu.ContextMenu>
        <Box
          className={holds ? classes.container : classes.holder}
          data-kind={element.kind}
          data-state={holds ? state : undefined}
          data-leaving={data.leaving || undefined}
        >
          <Handle
            type="target"
            position={into}
            isConnectable={false}
            className={classes.handle}
          />
          {/* Shut while the card's own menu is open, so it never covers it. */}
          {/* Slower than elsewhere: a pointer crosses cards on its way about the canvas. */}
          <ElementTooltip
            name={addressOf(element.id)}
            disabled={menu}
            openDelay={600}
          >
            {button}
          </ElementTooltip>
          {/* Over the card, beside its button rather than in it: one button
          cannot hold another. */}
          {holds && (
            <FrameResizer
              element={element}
              shown={state === 'selected' && !data.leaving}
            />
          )}
          <Contains element={element} />
          <Remove id={element.id} name={element.name} holds={holds} />
          <Handle
            type="source"
            position={outOf}
            isConnectable={false}
            className={classes.handle}
          />
        </Box>
      </Menu.ContextMenu>
      <NodeMenuDropdown id={element.id} name={element.name} holds={holds} />
    </Menu>
  );
}
