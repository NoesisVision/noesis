import type { DiagramTheme } from '../diagram-theme.ts';
import classes from './isometric.module.css';

/** Each box stood up off the canvas, seen from above and to the left. */
export const isometric = {
  id: '3d',
  label: 'Isometric (3D)',
  className: classes.theme,
} as const satisfies DiagramTheme;
