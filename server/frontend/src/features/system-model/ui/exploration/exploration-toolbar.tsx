import { IconArrowBackUp, IconArrowForwardUp } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Group } from '#/shared/design-system/group.tsx';
import { SegmentedControl } from '#/shared/design-system/segmented-control.tsx';
import { Switch } from '#/shared/design-system/switch.tsx';
import { Text } from '#/shared/design-system/text.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import { IconBroom } from '#/shared/ui/icons/icons.ts';
import type { LayoutDirection } from './layout-exploration.ts';
import classes from './exploration.module.css';

/** How the exploration is drawn, as the reader set it. */
export interface Drawing {
  direction: LayoutDirection;
  /** Edges at right angles rather than in curves. */
  orthogonal: boolean;
  /** Edges as dashes running towards their target. */
  animated: boolean;
}

const DIRECTIONS = [
  { value: 'vertical', label: 'Vertical' },
  { value: 'horizontal', label: 'Horizontal' },
] satisfies { value: LayoutDirection; label: string }[];

/** A control with its name written before it. */
function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Group gap={8} wrap="nowrap">
      <Text
        component="span"
        fz="xs"
        c="var(--noesis-secondary-text)"
        aria-hidden
      >
        {label}
      </Text>
      {children}
    </Group>
  );
}

/*
 * How the reader draws the exploration — what is drawn is chosen in the
 * picker on the canvas, and what shows of it in the visibility panel this
 * opens: which way the layout runs, how the edges
 * run, and how close.
 */
export function ExplorationToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  visibility,
  onVisibility,
  veiledCount,
  drawing,
  onDrawing,
  onAutoPlace,
  children,
}: {
  /** Whether there is a step to go back to, or forward to again. */
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Whether the visibility panel is open, and the way to open or shut it. */
  visibility: boolean;
  onVisibility: (open: boolean) => void;
  /** How many kinds the panel hides, said beside its button. */
  veiledCount: number;
  drawing: Drawing;
  onDrawing: (drawing: Drawing) => void;
  onAutoPlace: () => void;
  /** The zoom controls, last in the row. */
  children: ReactNode;
}) {
  const set = (change: Partial<Drawing>) =>
    onDrawing({ ...drawing, ...change });
  return (
    <Group
      flex="none"
      py="sm"
      px="md"
      gap="8px 18px"
      className={classes.toolbar}
    >
      <Group gap={4} wrap="nowrap">
        <Tooltip label="Undo">
          <ActionIcon
            variant="default"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <IconArrowBackUp size={18} stroke={1.6} aria-hidden />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Redo">
          <ActionIcon
            variant="default"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={onRedo}
          >
            <IconArrowForwardUp size={18} stroke={1.6} aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Button
        variant={visibility ? 'light' : 'default'}
        size="xs"
        aria-pressed={visibility}
        onClick={() => onVisibility(!visibility)}
      >
        Visibility
        {veiledCount > 0 && (
          <Badge component="span" size="sm" ml={8} tt="none">
            {`${veiledCount} ${veiledCount === 1 ? 'kind' : 'kinds'} hidden`}
          </Badge>
        )}
      </Button>
      <Labelled label="Direction">
        <SegmentedControl
          size="xs"
          aria-label="Direction"
          data={DIRECTIONS}
          value={drawing.direction}
          onChange={(value) =>
            set({
              direction: value === 'horizontal' ? 'horizontal' : 'vertical',
            })
          }
        />
      </Labelled>
      <Switch
        size="xs"
        label="Orthogonal edges"
        checked={drawing.orthogonal}
        onChange={(event) => set({ orthogonal: event.currentTarget.checked })}
      />
      <Switch
        size="xs"
        label="Animate edges"
        checked={drawing.animated}
        onChange={(event) => set({ animated: event.currentTarget.checked })}
      />
      <Button
        variant="default"
        size="xs"
        leftSection={<IconBroom size={16} stroke={1.6} aria-hidden />}
        onClick={onAutoPlace}
      >
        Auto-place
      </Button>
      <Group ml="auto">{children}</Group>
    </Group>
  );
}
