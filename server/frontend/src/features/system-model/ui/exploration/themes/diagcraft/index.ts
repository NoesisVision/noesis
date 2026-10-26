// Its lettering; the font's files load only when the theme draws with it.
import '@fontsource-variable/pixelify-sans';
import { BackgroundVariant } from '@xyflow/react';
import type { DiagramTheme } from '../diagram-theme.ts';
import classes from './diagcraft.module.css';

/*
 * A world of blocks: modules grass blocks, building blocks stone, cards oak
 * planks, behaviours gold, value objects diamond, on a field of grass.
 */
export const diagcraft = {
  id: 'diagcraft',
  label: 'Diagcraft',
  className: classes.theme,
  background: {
    variant: BackgroundVariant.Lines,
    gap: 32,
    lineWidth: 1,
    color: '#6aa543',
    bgColor: '#79b84f',
  },
} as const satisfies DiagramTheme;
