import { MarkerType } from '@xyflow/react';
import {
  DRAWN_RELATIONS,
  type DrawnRelationKind,
} from '../../system-model-exploration.ts';

/*
 * Each relation drawn as an edge, as the canvas is told to draw it: its
 * line and arrow, its word, and its dashes when the edges run. How each
 * looks — colours in both schemes, dash, gap and speed — is set in one
 * place, `relationEdges` in theme.ts, as the `--noesis-diagram-edge-<kind>`
 * tokens; this only names them. A diagram theme may set its own colours
 * (`--edge-state`, `--edge-invokes`, as themes.ts says). A relation drawn
 * as an edge from here on needs its entry there and in DRAWN_RELATIONS.
 */
const tokenOf = (kind: DrawnRelationKind, part = '') =>
  `var(--noesis-diagram-edge-${kind}${part})`;

/** A theme's own colour for the kind, over the token's. */
const themedOf = (kind: DrawnRelationKind, part = '') =>
  `var(--edge-${kind}, ${tokenOf(kind, part)})`;

const forEachKind = <T>(valueOf: (kind: DrawnRelationKind) => T) =>
  Object.fromEntries(
    DRAWN_RELATIONS.map(({ kind }) => [kind, valueOf(kind)]),
  ) as Record<DrawnRelationKind, T>;

export const EDGE_COLOR = forEachKind((kind) => themedOf(kind));

export const EDGE_WORD = forEachKind((kind) => themedOf(kind, '-word'));

/** Its dashes when the edges run: a dash, a gap, and the time to move them along. */
export const edgeDashOf = (kind: DrawnRelationKind) => ({
  dash: tokenOf(kind, '-dash'),
  gap: tokenOf(kind, '-gap'),
  time: tokenOf(kind, '-time'),
});

/*
 * The shape of each relation's arrow, so they read apart without their
 * colour: what an element holds, works with, takes or gives back, an open arrowhead, as
 * a dependency is drawn; what it extends, an open one too, as inheritance
 * is; what it invokes, a solid one, as a call is, and what an actor
 * performs, a solid one too. The canvas draws it from a
 * name, not a style, so it cannot be a token.
 */
export const EDGE_ARROW = {
  state: MarkerType.Arrow,
  collaborator: MarkerType.Arrow,
  input: MarkerType.Arrow,
  output: MarkerType.Arrow,
  extends: MarkerType.Arrow,
  invokes: MarkerType.ArrowClosed,
  performs: MarkerType.ArrowClosed,
} as const satisfies Record<DrawnRelationKind, MarkerType>;
