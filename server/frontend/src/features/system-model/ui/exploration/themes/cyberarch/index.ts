import { BackgroundVariant } from '@xyflow/react';
import type { DiagramTheme } from '../diagram-theme.ts';
import classes from './cyberarch.module.css';

/*
 * A night city's HUD: glass in neon cyan, red and yellow, square and
 * notched, glowing, on a grid under scanlines — black by night, pale by day.
 */
export const cyberarch = {
  id: 'cyberarch',
  label: 'Cyberarch 2027',
  className: classes.theme,
  background: {
    variant: BackgroundVariant.Lines,
    gap: 40,
    lineWidth: 1,
    // Light, then dark, as the stylesheet's palette.
    color: 'light-dark(rgb(0 137 163 / 0.1), rgb(2 215 242 / 0.08))',
    bgColor: 'light-dark(#eef2f7, #07070d)',
  },
} as const satisfies DiagramTheme;
