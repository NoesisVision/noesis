import { IconChevronDown, IconKeyboard } from '@tabler/icons-react';
import { useId, useState } from 'react';
import { Box } from '#/shared/design-system/box.tsx';
import { Collapse } from '#/shared/design-system/collapse.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { Kbd } from '#/shared/design-system/kbd.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { UnstyledButton } from '#/shared/design-system/unstyled-button.tsx';
import classes from './exploration.module.css';

/** Each shortcut: its keys, either of which does it, and what it does. */
const SHORTCUTS = [
  { keys: ['Space'], does: 'Add to the exploration' },
  { keys: ['Double-click'], does: 'On the empty canvas, add an element there' },
  { keys: ['Ctrl', '⌘'], does: 'With a click, add a card to the selection' },
  { keys: ['Ctrl A', '⌘ A'], does: 'Select every card in sight' },
  { keys: ['Delete', '⌫'], does: 'Remove the selected cards' },
  { keys: ['Ctrl Z', '⌘ Z'], does: 'Undo a step' },
  { keys: ['Ctrl ⇧ Z', 'Ctrl Y'], does: 'Redo it' },
  { keys: ['Esc'], does: 'Let go of the cards, or close the picker' },
  { keys: ['↓'], does: 'In the picker, from the filter into the tree' },
  { keys: ['Space', 'Enter'], does: 'In the picker, tick a row in or out' },
] as const;

/*
 * The keys the exploration answers to, in the canvas's corner. It folds to
 * its title, sliding shut, so it need not lie over the cards for good.
 */
export function ShortcutLegend() {
  const [open, setOpen] = useState(true);
  const list = useId();
  return (
    <Box
      component="section"
      aria-label="Keyboard shortcuts"
      className={`nowheel nopan ${classes.legend}`}
    >
      <UnstyledButton
        className={classes.legendHead}
        aria-expanded={open}
        aria-controls={list}
        onClick={() => setOpen((was) => !was)}
      >
        <IconKeyboard size={16} stroke={1.6} aria-hidden />
        <Text component="span" fz="xs" fw={600} flex={1}>
          Keyboard shortcuts
        </Text>
        <IconChevronDown
          size={14}
          stroke={1.6}
          aria-hidden
          className={classes.legendChevron}
          data-open={open || undefined}
        />
      </UnstyledButton>
      <Collapse id={list} expanded={open}>
        <dl className={classes.legendList}>
          {SHORTCUTS.map(({ keys, does }) => (
            <div key={does} className={classes.legendRow}>
              <dt>
                <Group gap={4} wrap="nowrap">
                  {keys.map((key) => (
                    <Kbd key={key} size="xs">
                      {key}
                    </Kbd>
                  ))}
                </Group>
              </dt>
              <Text component="dd" fz="xs" c="var(--noesis-secondary-text)">
                {does}
              </Text>
            </div>
          ))}
        </dl>
      </Collapse>
    </Box>
  );
}
