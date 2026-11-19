import { IconDots, IconPlus } from '@tabler/icons-react';
import { type MouseEvent, useState } from 'react';
import { KindIcon } from '#/features/design-docs/element-reader.ts';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Menu } from '#/shared/design-system/menu.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { IconAutoPlace, IconParentFrame } from '#/shared/ui/icons/icons.ts';
import {
  CHAIN_DEPTH,
  type ChainReach,
  groupLabelOf,
  isSlotReach,
  type Reach,
  relationOfChain,
} from '../../system-model-exploration.ts';
import { useCardActions } from './exploration-reading.ts';
import type { CanvasPoint } from './place-locally.ts';
import { AUTO_PLACE, REACH_ACTION, showParentLabel } from './reach-words.ts';
import { useThemedSurface } from './themes/diagram-theme-context.ts';
import { useLazyOpening } from './use-lazy-opening.ts';
import {
  hasNodeMenu,
  useAdd,
  useChains,
  useMissing,
  useMissingParent,
} from './use-reaches.ts';
import classes from './exploration.module.css';

/*
 * A card's own menu: each way it reaches others, opening onto them.
 */

/** What a reach's menu offers: all of them at once, when more than one, then each by name and kind. */
export function ReachItems({
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
export const keepInMenu = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

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
        onShow(missing, true, id, false, undefined, isSlotReach(reach));
      }}
    >
      {`${REACH_ACTION[reach]}: ${missing.length}`}
    </Menu.Item>
  );
}

/*
 * The card's own menu, from a right click on it or its dots: a frame's
 * setting out again of what it holds; the way to its parent, when that is
 * not on the diagram, set apart between two rules; then each way it reaches
 * others not yet drawn, opening onto them as its button's menu does.
 */
export function NodeMenuDropdown({
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
  // Its parent has a place of its own in the menu, above the rest.
  const missing = (useMissing(id) ?? []).filter(
    ({ each }) => each !== 'isPartOf',
  );
  const parent = useMissingParent(id);
  const showParent = useAdd(id, 'isPartOf');
  const chains = useChains(id);
  const element = elements.get(id);
  const surface = useThemedSurface('menu', `nowheel ${classes.nodeMenu}`);
  return (
    <Menu.Dropdown {...surface} onContextMenu={keepInMenu}>
      {/* Whose menu it is, set apart from what it offers. */}
      <Menu.Label className={classes.nodeMenuTitle}>{name}</Menu.Label>
      {/* A frame's own first: setting out again what it holds. */}
      {holds && (
        <>
          <Menu.Divider />
          <Menu.Item
            // The toolbar's own, for the whole diagram.
            leftSection={<IconAutoPlace size={14} stroke={1.8} aria-hidden />}
            onClick={() => onArrange(id)}
          >
            {AUTO_PLACE}
          </Menu.Item>
        </>
      )}
      {/* The way to what holds it, a rule above it and one below. */}
      {parent !== null && (
        <>
          <Menu.Divider />
          <Menu.Item
            leftSection={<IconParentFrame size={14} stroke={1.8} aria-hidden />}
            onClick={() => showParent([parent.id])}
          >
            {showParentLabel(parent)}
          </Menu.Item>
        </>
      )}
      <Menu.Divider />
      {/* With only chains to follow, there is no "Add" with nothing under it. */}
      {(missing.length > 0 || chains.length === 0) && (
        <Menu.Label>Add</Menu.Label>
      )}
      {missing.length === 0 && chains.length === 0 && (
        <Menu.Item disabled>Nothing more to add</Menu.Item>
      )}
      {missing.map(({ each, missing: them }) => (
        <NodeMenuEntry key={each} id={id} reach={each} missing={them} at={at} />
      ))}
      {/* Each way followed through all it reaches, up to the next of its type. */}
      {chains.length > 0 && element !== undefined && (
        <>
          {missing.length > 0 && <Menu.Divider />}
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
  const surface = useThemedSurface('menu', `nowheel ${classes.reachMenu}`);
  return (
    <Menu.Sub>
      <Menu.Sub.Target>
        <Menu.Sub.Item>
          {`${REACH_ACTION[reach]}: ${missing.length}`}
        </Menu.Sub.Item>
      </Menu.Sub.Target>
      <Menu.Sub.Dropdown {...surface}>
        <ReachItems id={id} reach={reach} missing={missing} at={at} />
      </Menu.Sub.Dropdown>
    </Menu.Sub>
  );
}

/**
 * Whether the card's own menu has anything to offer: a frame's setting out
 * again of what it holds, or others it reaches to bring in. With nothing,
 * a card shows no dots and opens no menu.
 */
function useHasNodeMenu(id: string, holds: boolean) {
  return hasNodeMenu(id, holds, useCardActions());
}

/** Where the card's own menu opens: at the pointer, or under its dots. */
export const NODE_MENU = {
  shadow: 'md',
  withinPortal: true,
  position: 'bottom-start',
  // The canvas stops a mouse press from reaching the page; a pointer's does.
  clickOutsideEvents: ['pointerdown'] as string[],
} as const;

/**
 * The card's dots, in its corner beside the way off: its own menu, drawn
 * once it is first asked for (use-lazy-opening.ts).
 */
export function NodeMenuButton({
  id,
  name,
  holds,
}: {
  id: string;
  name: string;
  holds: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { mounted, opener } = useLazyOpening(open, setOpen);
  if (!useHasNodeMenu(id, holds)) return null;
  return (
    <>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        aria-label={`More for ${name}`}
        data-tip="All actions · also on right-click"
        aria-haspopup="menu"
        aria-expanded={open}
        {...opener}
      >
        <IconDots size={14} stroke={1.8} aria-hidden />
      </ActionIcon>
      {mounted && (
        <Menu opened={open} onChange={setOpen} {...NODE_MENU}>
          <Menu.Target>
            <span aria-hidden className={classes.opening} />
          </Menu.Target>
          <NodeMenuDropdown id={id} name={name} holds={holds} />
        </Menu>
      )}
    </>
  );
}
