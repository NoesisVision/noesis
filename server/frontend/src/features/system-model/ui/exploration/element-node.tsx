import {
  IconArrowLeft,
  IconArrowRight,
  IconCornerLeftUp,
  IconLayoutDistributeHorizontal,
  IconPlus,
  IconSubtask,
  IconTrash,
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
import { useState } from 'react';
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
import {
  addressOf,
  groupLabelOf,
  kindWordOf,
  type Reach,
  REACHES,
} from '../../system-model-exploration.ts';
import { useCardActions, useSelectionState } from './exploration-reading.ts';
import {
  frameWidthOf,
  HEIGHT,
  type LayoutDirection,
  PADDING,
  type PlacedElement,
} from './layout-exploration.ts';
import classes from './exploration.module.css';

/*
 * What React Flow draws for an element: a card with its name and what it
 * is, or — when others are drawn inside it — a frame with both at its top.
 * The card, or the frame's name, is a button that selects the element, and
 * hovered or focused says what the element is, as the model's tooltips do.
 * Edges come in where the layout's flow does and leave the other side.
 * Inside, it always shows the way off the diagram, in its corner, and under
 * what the element is what it can still bring beside it — what it contains,
 * is part of, uses and is used by.
 */

export type ExplorationNode = Node<{
  placed: PlacedElement;
  direction: LayoutDirection;
  /** Taken off the diagram, and drawn a moment longer to leave it. */
  leaving?: boolean;
}>;

const REACH_ICON = {
  contains: IconSubtask,
  isPartOf: IconCornerLeftUp,
  uses: IconArrowRight,
  usedBy: IconArrowLeft,
} as const satisfies Record<Reach, unknown>;

/** What a reach's button says it brings, of how many. */
const reachLabel = (reach: Reach, name: string, count: number) => {
  const them = count === 1 ? 'the element' : `the ${count} elements`;
  switch (reach) {
    case 'contains':
      return `Show ${them} ${name} contains`;
    case 'isPartOf':
      return `Show what ${name} is part of`;
    case 'uses':
      return `Show ${them} ${name} uses`;
    case 'usedBy':
      return `Show ${them} that use ${name}`;
  }
};

/*
 * Inside the card, under what the element is: a small button for each way
 * it reaches others not yet drawn, with how many; each opens a menu of
 * them to put on the diagram beside it. None when it has nothing left to
 * bring. A frame's row starts with the way to arrange what it holds.
 */
function Reaches({
  id,
  name,
  holds,
}: {
  id: string;
  name: string;
  holds: boolean;
}) {
  const { drawn, neighbours, onArrange } = useCardActions();
  const reach = neighbours.get(id);
  if (reach === undefined) return null;
  const open = REACHES.map((each) => ({
    each,
    missing: reach[each].filter((other) => !drawn.has(other)),
  })).filter(({ missing }) => missing.length > 0);
  // Nothing left to bring and nothing to arrange: no group at all.
  if (!holds && open.length === 0) return null;
  return (
    <div className={`nodrag nopan ${classes.reaches}`}>
      {holds && (
        <Tooltip label={`Arrange what ${name} holds`}>
          <UnstyledButton
            className={classes.reach}
            aria-label={`Arrange what ${name} holds`}
            onClick={() => onArrange(id)}
          >
            <IconLayoutDistributeHorizontal
              size={14}
              stroke={1.8}
              aria-hidden
            />
          </UnstyledButton>
        </Tooltip>
      )}
      {open.map(({ each, missing }) => (
        <ReachMenu
          key={each}
          id={id}
          name={name}
          reach={each}
          missing={missing}
        />
      ))}
    </div>
  );
}

/** What a reach's menu is headed with: the relation, read from this card. */
const reachHeading = (reach: Reach, name: string) => {
  switch (reach) {
    case 'contains':
      return `What ${name} contains`;
    case 'isPartOf':
      return `What ${name} is part of`;
    case 'uses':
      return `What ${name} uses`;
    case 'usedBy':
      return `What uses ${name}`;
  }
};

/*
 * One way the element reaches others, as a button that opens a menu of
 * them: all at once first, then each by name and kind. What it contains,
 * once on the diagram inside it, is arranged there.
 */
function ReachMenu({
  id,
  name,
  reach,
  missing,
}: {
  id: string;
  name: string;
  reach: Reach;
  missing: string[];
}) {
  const { elements, onShow } = useCardActions();
  const Icon = REACH_ICON[reach];
  const label = reachLabel(reach, name, missing.length);
  const add = (ids: string[]) => onShow(ids, true, id, reach === 'contains');
  // Held here, so the button can say so: the tooltip between the menu and
  // its button keeps the menu's own word on it from reaching the button.
  const [open, setOpen] = useState(false);
  // An element is part of one other at most: no count to give and nothing
  // to choose, so the button brings it straight away.
  if (reach === 'isPartOf' && missing.length === 1)
    return (
      <Tooltip label={label}>
        <UnstyledButton
          className={classes.reach}
          aria-label={label}
          onClick={() => add(missing)}
        >
          <Icon size={14} stroke={1.8} aria-hidden />
        </UnstyledButton>
      </Tooltip>
    );
  return (
    <Menu
      opened={open}
      onChange={setOpen}
      position="bottom-start"
      shadow="md"
      withinPortal
      // The canvas stops a mouse press from reaching the page; a pointer's does.
      clickOutsideEvents={['pointerdown']}
    >
      <Menu.Target>
        <Tooltip label={label}>
          <UnstyledButton
            className={classes.reach}
            aria-label={label}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <Icon size={14} stroke={1.8} aria-hidden />
            <span className={classes.reachCount}>{missing.length}</span>
          </UnstyledButton>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown className={`nowheel ${classes.reachMenu}`}>
        <Menu.Label>{reachHeading(reach, name)}</Menu.Label>
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
      </Menu.Dropdown>
    </Menu>
  );
}

/**
 * The least a frame may be resized to: round what it holds, as dragged,
 * and wide enough for its name beside the cross.
 */
function useFrameMinimum(id: string, name: string) {
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
  return {
    minWidth: Math.max(frameWidthOf(name), right + PADDING.right),
    minHeight: Math.max(HEIGHT, bottom + PADDING.bottom),
  };
}

/** Handles round a frame in hand, to make it larger or smaller. */
function FrameResizer({
  id,
  name,
  shown,
}: {
  id: string;
  name: string;
  shown: boolean;
}) {
  const { minWidth, minHeight } = useFrameMinimum(id, name);
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
 * In the top right corner, the way off the diagram: a card's one cross; a
 * frame's two — the cross taking only the frame, what it held staying where
 * it stands, and the bin taking it with everything inside.
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
    <div className={`nodrag nopan ${classes.removes}`}>
      {holds && (
        <Tooltip label="Remove with what it holds">
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            aria-label={`Remove ${name} and what it holds from the view`}
            onClick={() => onShow([id], false, id)}
          >
            <IconTrash size={14} stroke={1.8} aria-hidden />
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
          onClick={() => (holds ? onRemoveAlone(id) : onShow([id], false, id))}
        >
          <IconX size={14} stroke={1.8} aria-hidden />
        </ActionIcon>
      </Tooltip>
    </div>
  );
}

/** What a card is to the selection, for a reader who cannot see its border. */
const withState = (label: string, state: 'selected' | 'related' | undefined) =>
  state === 'related' ? `${label}, related to the selection` : label;

export function ElementNode({ data }: NodeProps<ExplorationNode>) {
  const { element, holds } = data.placed;
  const { state, onSelect } = useSelectionState(element.id);
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
      <ElementTooltip name={addressOf(element.id)}>{button}</ElementTooltip>
      {/* Over the card, beside its button rather than in it: one button
          cannot hold another. */}
      {holds && (
        <FrameResizer
          id={element.id}
          name={element.name}
          shown={state === 'selected' && !data.leaving}
        />
      )}
      <Reaches id={element.id} name={element.name} holds={holds} />
      <Remove id={element.id} name={element.name} holds={holds} />
      <Handle
        type="source"
        position={outOf}
        isConnectable={false}
        className={classes.handle}
      />
    </Box>
  );
}
