import type { BackgroundProps } from '@xyflow/react';

/** One way of drawing the exploration's diagram (see themes.ts). */
export interface DiagramTheme {
  /** Kept in the reader's storage: once a theme is out, never changed. */
  id: string;
  /** Its name in the theme menu. */
  label: string;
  /** The root class of its stylesheet, set on the canvas; none draws it plain. */
  className?: string;
  /** The canvas behind the diagram; none keeps the plain dots. */
  background?: BackgroundProps;
}
