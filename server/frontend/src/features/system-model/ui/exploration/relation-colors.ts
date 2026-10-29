import { MarkerType } from '@xyflow/react';
import type { DrawnRelationKind } from '../../system-model-exploration.ts';

/*
 * Each relation drawn as an edge, as the canvas is told to draw it: its
 * line and arrow, its word, and its dashes when the edges run. How each
 * looks — colours in both schemes, dash, gap and speed — is set in one
 * place, `relationEdges` in theme.ts, as the `--noesis-diagram-edge-<kind>`
 * tokens; this only names them. A diagram theme may set its own colours
 * (`--edge-uses`, `--edge-invokes`, as exploration.module.css says). A
 * relation drawn as an edge from here on needs its entry there and here.
 */
const tokenOf = (kind: DrawnRelationKind, part = '') =>
  `var(--noesis-diagram-edge-${kind}${part})`;

export const EDGE_COLOR = {
  uses: `var(--edge-uses, ${tokenOf('uses')})`,
  invokes: `var(--edge-invokes, ${tokenOf('invokes')})`,
} as const satisfies Record<DrawnRelationKind, string>;

export const EDGE_WORD = {
  uses: `var(--edge-uses, ${tokenOf('uses', '-word')})`,
  invokes: `var(--edge-invokes, ${tokenOf('invokes', '-word')})`,
} as const satisfies Record<DrawnRelationKind, string>;

/** Its dashes when the edges run: a dash, a gap, and the time to move them along. */
export const edgeDashOf = (kind: DrawnRelationKind) => ({
  dash: tokenOf(kind, '-dash'),
  gap: tokenOf(kind, '-gap'),
  time: tokenOf(kind, '-time'),
});

/*
 * The shape of each relation's arrow, so the two read apart without their
 * colour: what an element uses, an open arrowhead, as a dependency is drawn;
 * what it invokes, a solid one, as a call is. The canvas draws it from a
 * name, not a style, so it cannot be a token.
 */
export const EDGE_ARROW = {
  uses: MarkerType.Arrow,
  invokes: MarkerType.ArrowClosed,
} as const satisfies Record<DrawnRelationKind, MarkerType>;
