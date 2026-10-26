import type { DrawnRelationKind } from '../../system-model-exploration.ts';

/*
 * The colour of each relation drawn as an edge: its line and its arrow. A
 * relation drawn as an edge from here on needs only its colour here.
 */
export const EDGE_COLOR = {
  hasProperty: 'var(--mantine-color-teal-filled)',
  hasInput: 'var(--mantine-color-cyan-filled)',
  hasOutput: 'var(--mantine-color-indigo-filled)',
  uses: 'var(--mantine-color-brand-filled)',
  invokes: 'var(--mantine-color-grape-filled)',
} as const satisfies Record<DrawnRelationKind, string>;
