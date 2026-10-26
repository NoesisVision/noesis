import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowsHorizontal,
  IconArrowsVertical,
  IconChevronDown,
  IconEye,
  IconLayoutDistributeHorizontal,
  IconRoute,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Box } from '#/shared/design-system/box.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { SegmentedControl } from '#/shared/design-system/segmented-control.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import {
  CanvasToolbar,
  ToolbarDivider,
  ToolbarOptions,
  ToolbarPill,
} from '#/shared/ui/canvas-toolbar.tsx';
import type { LayoutDirection } from './layout-exploration.ts';
import classes from './exploration.module.css';

/** How the exploration is drawn, as the reader set it. */
export interface Drawing {
  direction: LayoutDirection;
  /** Edges at right angles rather than in curves. */
  orthogonal: boolean;
  /** Edges as dashes running towards their target. */
  animated: boolean;
  /** Modules raised off the canvas, in 3D, rather than flat on it. */
  depth: boolean;
}

/** The two views: flat, or with the modules raised off the canvas. */
const VIEWS = [
  { value: '2d', label: '2D' },
  { value: '3d', label: '3D' },
];

/** Each way the layout may run, by its arrow; its name for whoever cannot see it. */
const DIRECTIONS = [
  {
    value: 'vertical',
    label: (
      <Tooltip label="Vertical" openDelay={300}>
        <Box component="span" className={classes.segmentIcon}>
          <IconArrowsVertical size={16} stroke={1.6} aria-hidden />
          <VisuallyHidden>Vertical</VisuallyHidden>
        </Box>
      </Tooltip>
    ),
  },
  {
    value: 'horizontal',
    label: (
      <Tooltip label="Horizontal" openDelay={300}>
        <Box component="span" className={classes.segmentIcon}>
          <IconArrowsHorizontal size={16} stroke={1.6} aria-hidden />
          <VisuallyHidden>Horizontal</VisuallyHidden>
        </Box>
      </Tooltip>
    ),
  },
] satisfies { value: LayoutDirection; label: ReactNode }[];

/*
 * How the reader draws the exploration — what is drawn is chosen in the
 * picker on the canvas, and what shows of it in the visibility panel this
 * opens: steps back and forward, which way the layout runs, how the edges
 * run, flat or in depth, placing everything afresh, and — at the far end — how close.
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
  /** The zoom controls, at the row's far end. */
  children: ReactNode;
}) {
  const set = (change: Partial<Drawing>) =>
    onDrawing({ ...drawing, ...change });
  return (
    <CanvasToolbar end={children}>
      <ToolbarPill>
        <Tooltip label="Undo">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <IconArrowBackUp size={18} stroke={1.6} aria-hidden />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Redo">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={onRedo}
          >
            <IconArrowForwardUp size={18} stroke={1.6} aria-hidden />
          </ActionIcon>
        </Tooltip>
      </ToolbarPill>
      <ToolbarDivider />
      <Button
        variant={visibility ? 'light' : 'subtle'}
        color={visibility ? undefined : 'gray'}
        aria-pressed={visibility}
        leftSection={<IconEye size={16} stroke={1.6} aria-hidden />}
        rightSection={
          <IconChevronDown
            size={14}
            stroke={1.6}
            aria-hidden
            className={classes.chevron}
            data-open={visibility || undefined}
          />
        }
        onClick={() => onVisibility(!visibility)}
      >
        Visibility
        {veiledCount > 0 && (
          <Badge component="span" size="sm" ml={8} tt="none">
            {`${veiledCount} ${veiledCount === 1 ? 'kind' : 'kinds'} hidden`}
          </Badge>
        )}
      </Button>
      <SegmentedControl
        aria-label="Direction"
        data={DIRECTIONS}
        value={drawing.direction}
        onChange={(value) =>
          set({
            direction: value === 'horizontal' ? 'horizontal' : 'vertical',
          })
        }
      />
      <ToolbarOptions
        label="Edges"
        icon={IconRoute}
        title="How the edges run"
        options={[
          {
            label: 'Orthogonal edges',
            checked: drawing.orthogonal,
            onChange: (orthogonal) => set({ orthogonal }),
          },
          {
            label: 'Animate edges',
            checked: drawing.animated,
            onChange: (animated) => set({ animated }),
          },
        ]}
      />
      <SegmentedControl
        aria-label="View"
        data={VIEWS}
        value={drawing.depth ? '3d' : '2d'}
        onChange={(value) => set({ depth: value === '3d' })}
      />
      <ToolbarDivider />
      <Button
        variant="light"
        leftSection={
          <IconLayoutDistributeHorizontal size={16} stroke={1.6} aria-hidden />
        }
        onClick={onAutoPlace}
      >
        Auto-place
      </Button>
    </CanvasToolbar>
  );
}
