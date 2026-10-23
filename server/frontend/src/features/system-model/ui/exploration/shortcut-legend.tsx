import { IconKeyboard } from '@tabler/icons-react';
import { Group } from '#/shared/design-system/group.tsx';
import { Kbd } from '#/shared/design-system/kbd.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { CanvasLegend } from '#/shared/ui/canvas-legend.tsx';
import classes from './exploration.module.css';

/** Each shortcut: its keys, either of which does it, and what it does. */
const SHORTCUTS = [
  { keys: ['Space'], does: 'Add to the exploration' },
  { keys: ['Right-click'], does: 'On the empty canvas, add an element there' },
  { keys: ['Right-click'], does: 'On a card, its actions' },
  { keys: ['Double-click'], does: 'Zoom in' },
  { keys: ['Ctrl', '⌘'], does: 'With a click, add a card to the selection' },
  { keys: ['Ctrl A', '⌘ A'], does: 'Select every card in sight' },
  { keys: ['Delete', '⌫'], does: 'Remove the selected cards' },
  { keys: ['Ctrl Z', '⌘ Z'], does: 'Undo a step' },
  { keys: ['Ctrl ⇧ Z', 'Ctrl Y'], does: 'Redo it' },
  { keys: ['Esc'], does: 'Let go of the cards, or close the picker' },
  { keys: ['↓'], does: 'In the picker, from the filter into the tree' },
  {
    keys: ['Space', 'Enter'],
    does: 'In the picker, add a row, then all inside it, then take them off',
  },
] as const;

/** The keys the exploration answers to, in the canvas's corner. */
export function ShortcutLegend() {
  return (
    <CanvasLegend
      title="Keyboard shortcuts"
      icon={IconKeyboard}
      className={classes.legend}
    >
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
    </CanvasLegend>
  );
}
