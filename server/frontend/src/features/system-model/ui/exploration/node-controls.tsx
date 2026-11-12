import { IconPlus, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Menu } from '#/shared/design-system/menu.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import { IconFrameX } from '#/shared/ui/icons/icons.ts';
import { type DrawnElement } from '../../system-model-exploration.ts';
import { useCardActions } from './exploration-reading.ts';
import { keepInMenu, NodeMenuButton, ReachItems } from './reach-menu.tsx';
import { containsLabel } from './reach-words.ts';
import { useThemedSurface } from './themes/diagram-theme-context.ts';
import { useMissing } from './use-reaches.ts';
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
  // Held here, so the button can say so: the menu's own word on it.
  const [open, setOpen] = useState(false);
  const surface = useThemedSurface('menu', `nowheel ${classes.reachMenu}`);
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
          data-part="contains"
          data-frame={holds || undefined}
          data-kind={element.kind}
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <IconPlus size={12} stroke={2.4} aria-hidden />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown {...surface} onContextMenu={keepInMenu}>
        <Menu.Label>Contains:</Menu.Label>
        <ReachItems id={id} reach="contains" missing={missing} />
      </Menu.Dropdown>
    </Menu>
  );
}

/*
 * In the top right corner: the card's own menu, and apart from it the way
 * off the diagram — a card's one cross; a frame's two, the cross taking
 * only the frame, what it held staying where it stands, and the frame
 * crossed out taking it with everything inside.
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
