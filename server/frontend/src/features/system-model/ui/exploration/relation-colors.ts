import { MarkerType } from '@xyflow/react';
import type { DrawnRelationKind } from '../../system-model-exploration.ts';

/*
 * The colour of each relation drawn as an edge: its line and its arrow. A
 * relation drawn as an edge from here on needs its colour and its arrow here.
 */
export const EDGE_COLOR = {
  // A diagram theme may set its own (exploration.module.css).
  uses: 'var(--edge-uses, var(--mantine-color-brand-filled))',
  invokes: 'var(--edge-invokes, var(--mantine-color-grape-filled))',
} as const satisfies Record<DrawnRelationKind, string>;

/*
 * The shape of each relation's arrow, so the two read apart without their
 * colour: what an element uses, an open arrowhead, as a dependency is drawn;
 * what it invokes, a solid one, as a call is.
 */
export const EDGE_ARROW = {
  uses: MarkerType.Arrow,
  invokes: MarkerType.ArrowClosed,
} as const satisfies Record<DrawnRelationKind, MarkerType>;
