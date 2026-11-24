import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconChevronDown,
  IconEye,
  IconRoute,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { DesignDocsIcon } from '#/features/design-docs/design-docs.model.ts';
import { ActionIcon } from '#/shared/design-system/action-icon.tsx';
import { Badge } from '#/shared/design-system/badge.tsx';
import { Button } from '#/shared/design-system/button.tsx';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import {
  CanvasToolbar,
  ToolbarDivider,
  ToolbarOptions,
  ToolbarPill,
} from '#/shared/ui/canvas-toolbar.tsx';
import { IconAutoPlace } from '#/shared/ui/icons/icons.ts';
import { ONLY_THE_DESIGN, REORDER_DIAGRAM } from './reach-words.ts';
import classes from './exploration.module.css';

/** How the exploration is drawn, as the reader set it. */
export interface Drawing {
  /** Edges at right angles rather than in curves. */
  orthogonal: boolean;
  /** Edges as dashes running towards their target. */
  animated: boolean;
}

/*
 * How the reader draws the exploration — what is drawn is chosen in the
 * picker on the canvas, and what shows of it in the visibility panel this
 * opens: steps back and forward, how the edges run, placing everything
 * afresh, for a design drawn among the model going back to the design
 * alone, and — at the far end — how close.
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
  onlyDesign,
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
  /**
   * Draws a design drawn among the model as it opens: what the design
   * speaks of and what holds it, nothing it was brought in beside. Absent
   * on the model's own exploration; `drawn` when that is all there is.
   */
  onlyDesign?: { onShow: () => void; drawn: boolean };
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
      <ToolbarDivider />
      <Button
        variant="subtle"
        color="gray"
        leftSection={<IconAutoPlace size={16} stroke={1.6} aria-hidden />}
        onClick={onAutoPlace}
      >
        {REORDER_DIAGRAM}
      </Button>
      {onlyDesign !== undefined && (
        <Button
          variant="subtle"
          color="gray"
          leftSection={<DesignDocsIcon size={16} stroke={1.6} aria-hidden />}
          disabled={onlyDesign.drawn}
          onClick={onlyDesign.onShow}
        >
          {ONLY_THE_DESIGN}
        </Button>
      )}
    </CanvasToolbar>
  );
}
