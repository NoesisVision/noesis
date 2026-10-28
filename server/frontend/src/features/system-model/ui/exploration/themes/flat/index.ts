import type { DiagramTheme } from '../diagram-theme.ts';

/** The diagram as it is drawn with no theme: flat, the app's own colours. */
export const flat = {
  id: '2d',
  label: 'Flat (2D)',
} as const satisfies DiagramTheme;
