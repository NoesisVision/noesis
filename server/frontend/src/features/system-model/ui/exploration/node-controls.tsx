import { IconPlus, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Menu } from '#/shared/design-system/menu.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { IconParentFrame } from '#/shared/ui/icons/icons.ts';
import { type DrawnElement } from '../../system-model-exploration.ts';
import { useCardActions } from './exploration-reading.ts';
import { keepInMenu, NodeMenuButton, ReachItems } from './reach-menu.tsx';
import { containsLabel, showParentLabel } from './reach-words.ts';
import { useThemedSurface } from './themes/diagram-theme-context.ts';
import { useLazyOpening } from './use-lazy-opening.ts';
import { useAdd, useMissing, useMissingParent } from './use-reaches.ts';
import classes from './exploration.module.css';

/*
 * The controls round a card: the way to what it contains, and its cross.
 */

/*
 * On the middle of the bottom border of the card, or the frame, in its
 * colours, so it plainly belongs to that box: what it contains that is not
 * drawn yet, as a small round plus. It opens a menu of them: all at once
 * first, then each by name and
 * kind. What it contains, once on the diagram inside it, is arranged there.
 */
export function Contains({
  element,
  holds,
}: {
  element: DrawnElement;
  holds: boolean;
}) {
  const { id, name } = element;
  const contains = useMissing(id)?.find(({ each }) => each === 'contains');
  // Held here, so the button can say so: the menu's own word on it. The
  // menu itself is drawn once it is first asked for (use-lazy-opening.ts).
  const [open, setOpen] = useState(false);
  const { mounted, opener } = useLazyOpening(open, setOpen);
  const surface = useThemedSurface('menu', `nowheel ${classes.reachMenu}`);
  if (contains === undefined) return null;
  const { missing } = contains;
  const label = containsLabel(name, missing.length);
  return (
    <>
      <UnstyledButton
        className={`nodrag nopan ${classes.contains}`}
        data-part="contains"
        data-frame={holds || undefined}
        data-kind={element.kind}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        {...opener}
      >
        <IconPlus size={12} stroke={2.4} aria-hidden />
      </UnstyledButton>
      {mounted && (
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
            <span aria-hidden className={classes.containsSpot} />
          </Menu.Target>
          <Menu.Dropdown {...surface} onContextMenu={keepInMenu}>
            <Menu.Label>Contains:</Menu.Label>
            <ReachItems id={id} reach="contains" missing={missing} />
          </Menu.Dropdown>
        </Menu>
      )}
    </>
  );
}

/*
 * In the top right corner: the card's own menu, then the way to its parent
 * while that is not on the diagram; apart from them the way off the
 * diagram, its cross. A frame's cross takes it with everything inside: what
 * holds something never leaves without it.
 */
export function Remove({
  id,
  name,
  holds,
}: {
  id: string;
  name: string;
  holds: boolean;
}) {
  const { onShow } = useCardActions();
  const parent = useMissingParent(id);
  const showParent = useAdd(id, 'isPartOf');
  return (
    <div className={`nodrag nopan ${classes.corner}`}>
      {/* Apart from the ways off, so a click meant for it never takes one. */}
      <div className={classes.strip}>
        <NodeMenuButton id={id} name={name} holds={holds} />
        {parent !== null && (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            // How the card leaves the room for it (exploration.module.css).
            data-part="parent"
            aria-label={`${showParentLabel(parent)} of ${name}, ${parent.name}`}
            data-tip={`${showParentLabel(parent)} · ${parent.name}`}
            onClick={() => showParent([parent.id])}
          >
            <IconParentFrame size={14} stroke={1.8} aria-hidden />
          </ActionIcon>
        )}
      </div>
      <div className={classes.strip}>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          className={classes.remove}
          aria-label={
            holds
              ? `Remove ${name} and what it holds from the view`
              : `Remove ${name} from the view`
          }
          data-tip={holds ? 'Remove group' : 'Remove from the view'}
          onClick={() => onShow([id], false, id)}
        >
          <IconX size={14} stroke={1.8} aria-hidden />
        </ActionIcon>
      </div>
    </div>
  );
}
