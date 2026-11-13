import { type BackgroundProps, BackgroundVariant } from '@xyflow/react';

/*
 * Every diagram's canvas, dotted the same: the gap between the dots, and
 * the colours from the `--noesis-diagram-canvas` and `--noesis-diagram-dots`
 * tokens (theme.ts). A diagram theme may draw its own.
 */

/** The room between two dots, in pixels of the canvas. */
const DOT_GAP = 20;

/** React Flow's background, as every diagram draws it. */
export const DOT_GRID: BackgroundProps = {
  variant: BackgroundVariant.Dots,
  gap: DOT_GAP,
  size: 1,
  color: 'var(--noesis-diagram-dots)',
  bgColor: 'var(--noesis-diagram-canvas)',
};
