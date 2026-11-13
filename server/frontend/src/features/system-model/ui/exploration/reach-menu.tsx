import { IconDots, IconPlus } from '@tabler/icons-react';
import { type MouseEvent, useState } from 'react';
import { KindIcon } from '#/features/design-docs/element-reader.ts';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Menu } from '#/shared/design-system/menu.tsx';
import { Text } from '#/shared/design-system/text.tsx';
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
import { REACH_ACTION, TIDY_UP } from './reach-words.ts';
import { useThemedSurface } from './themes/diagram-theme-context.ts';
import { useAdd, useChains, useMissing } from './use-reaches.ts';
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
 * The card's own menu, from a right click on it or its dots: each way it
 * reaches others not yet drawn, opening onto them as its button's menu
 * does; its one parent, brought at once.
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
  const missing = useMissing(id) ?? [];
  const chains = useChains(id);
  const element = elements.get(id);
  const surface = useThemedSurface('menu', `nowheel ${classes.nodeMenu}`);
  return (
    <Menu.Dropdown {...surface} onContextMenu={keepInMenu}>
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
  const surface = useThemedSurface('menu', `nowheel ${classes.reachMenu}`);
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
export function useHasNodeMenu(id: string, holds: boolean) {
  const missing = useMissing(id) ?? [];
  const chains = useChains(id);
  return holds || missing.length > 0 || chains.length > 0;
}

/** Where the card's own menu opens: at the pointer, or under its dots. */
export const NODE_MENU = {
  shadow: 'md',
  withinPortal: true,
  position: 'bottom-start',
  // The canvas stops a mouse press from reaching the page; a pointer's does.
  clickOutsideEvents: ['pointerdown'] as string[],
} as const;

/** The card's dots, in its corner beside the way off: its own menu. */
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
  if (!useHasNodeMenu(id, holds)) return null;
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
