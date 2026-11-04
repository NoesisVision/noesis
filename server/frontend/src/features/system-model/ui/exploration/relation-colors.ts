import { MarkerType } from '@xyflow/react';
import {
  DRAWN_RELATIONS,
  type EdgeKind,
  HOLDING_KINDS,
} from '../../system-model-exploration.ts';

/*
 * Each relation drawn as an edge, as the canvas is told to draw it: its
 * line and arrow, its word, and its dashes when the edges run. How each
 * looks — colours in both schemes, dash, gap and speed — is set in one
 * place, `relationEdges` in theme.ts, as the `--noesis-diagram-edge-<kind>`
 * tokens; this only names them. A diagram theme may set its own colours
 * (`--edge-state`, `--edge-invokes`, as themes.ts says). A relation drawn
 * as an edge from here on needs its entry there and in DRAWN_RELATIONS.
 * What holds an element it is not drawn round is an edge too — a holding
 * of any kind — all in the one `contains` look.
 */
const lookOf = (kind: EdgeKind) =>
  (HOLDING_KINDS as readonly string[]).includes(kind) ? 'contains' : kind;

const tokenOf = (kind: EdgeKind, part = '') =>
  `var(--noesis-diagram-edge-${lookOf(kind)}${part})`;

/** A theme's own colour for the kind, over the token's. */
const themedOf = (kind: EdgeKind, part = '') =>
  `var(--edge-${lookOf(kind)}, ${tokenOf(kind, part)})`;

const EDGE_KINDS: readonly EdgeKind[] = [
  ...DRAWN_RELATIONS.map(({ kind }) => kind),
  ...HOLDING_KINDS,
];

const forEachKind = <T>(valueOf: (kind: EdgeKind) => T) =>
  Object.fromEntries(EDGE_KINDS.map((kind) => [kind, valueOf(kind)])) as Record<
    EdgeKind,
    T
  >;

export const EDGE_COLOR = forEachKind((kind) => themedOf(kind));

export const EDGE_WORD = forEachKind((kind) => themedOf(kind, '-word'));

/** Its dashes when the edges run: a dash, a gap, and the time to move them along. */
export const edgeDashOf = (kind: EdgeKind) => ({
  dash: tokenOf(kind, '-dash'),
  gap: tokenOf(kind, '-gap'),
  time: tokenOf(kind, '-time'),
});

/*
 * The shape of each relation's arrow, so they read apart without their
 * colour: what an element holds, works with, takes or gives back, an open arrowhead, as
 * a dependency is drawn; what it extends, an open one too, as inheritance
 * is; what it invokes, a solid one, as a call is, and what an actor
 * performs, a solid one too; what holds it, an open one. The canvas draws it from a
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
  contains: MarkerType.Arrow,
  ships: MarkerType.Arrow,
  provides: MarkerType.Arrow,
  places: MarkerType.Arrow,
  hosts: MarkerType.Arrow,
} as const satisfies Record<EdgeKind, MarkerType>;
