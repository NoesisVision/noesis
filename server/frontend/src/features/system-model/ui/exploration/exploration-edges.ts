import { type CSSProperties } from 'react';
import '@xyflow/react/dist/base.css';
import { type FloatingEdge } from '#/shared/ui/diagram-canvas/floating-edge.tsx';
import {
  type DrawnRelation,
  RELATION_WORD,
} from '../../system-model-exploration.ts';
import {
  EDGE_ARROW,
  EDGE_COLOR,
  EDGE_WORD,
  edgeDashOf,
} from './relation-colors.ts';
import classes from './exploration.module.css';

/*
 * A drawn relation as React Flow draws it: its line, its word, its arrow,
 * and where it stands to the selection.
 */

const ARROW = {
  width: 16,
  height: 16,
};

export function edgeOf(
  relation: DrawnRelation,
  {
    orthogonal,
    animated,
    highlight,
    zIndex,
  }: Pick<Required<FloatingEdge>['data'], 'orthogonal'> & {
    animated: boolean;
    /** Where the edge stands to the selection; nothing with none in hand. */
    highlight: 'highlighted' | 'faded' | undefined;
    /** How high it stands over its ends (edgeHeightOver). */
    zIndex: number;
  },
): FloatingEdge {
  return {
    id: relation.id,
    type: 'relation',
    source: relation.source,
    target: relation.target,
    data: { orthogonal },
    animated,
    label: RELATION_WORD[relation.kind],
    className:
      highlight === undefined
        ? classes.edge
        : `${classes.edge} ${classes[highlight]}`,
    style: {
      '--relation-color': EDGE_COLOR[relation.kind],
      // Its dashes, when the edges run (exploration.module.css).
      '--relation-dash': edgeDashOf(relation.kind).dash,
      '--relation-gap': edgeDashOf(relation.kind).gap,
      '--relation-dash-time': edgeDashOf(relation.kind).time,
    } as CSSProperties,
    // The word's own: the canvas puts `style` on the line alone.
    labelStyle: {
      '--relation-color': EDGE_WORD[relation.kind],
    } as CSSProperties,
    // Over every card and frame: see edgeHeightOver. The selection's
    // relations are drawn over the rest by coming last (exploration-view.tsx).
    zIndex,
    // A small pill on the line, its word in the relation's colour
    // (exploration.module.css draws the rest).
    labelBgPadding: [7, 3],
    labelBgBorderRadius: 8,
    markerEnd: {
      ...ARROW,
      type: EDGE_ARROW[relation.kind],
      color:
        highlight === 'highlighted'
          ? 'var(--edge-highlight, var(--noesis-diagram-highlight))'
          : EDGE_COLOR[relation.kind],
    },
  };
}

/**
 * How high an edge stands over its ends, so that it is drawn over every
 * card and frame on the canvas — over one it only passes, too, however
 * deep inside another that one is drawn. React Flow stands an edge as high
 * as the deeper of its ends that is drawn inside another, a card as high
 * as it is deep, and draws a card over an edge that stands as high: the
 * edge goes one over the deepest card, less what its ends already give it.
 * It meets its own ends at their edge, so it covers nothing inside them.
 */
export function edgeHeightOver(
  relation: DrawnRelation,
  depthOf: ReadonlyMap<string, number>,
  deepest: number,
): number {
  const ends = Math.max(
    depthOf.get(relation.source) ?? 0,
    depthOf.get(relation.target) ?? 0,
  );
  return deepest + 1 - ends;
}

/** How deep each drawn element is, inside the frames round it; a top one 0. */
export function depthsOf(
  elements: readonly { id: string; parent: string | null }[],
): ReadonlyMap<string, number> {
  const parentOf = new Map(elements.map(({ id, parent }) => [id, parent]));
  const depths = new Map<string, number>();
  const depth = (id: string): number => {
    const known = depths.get(id);
    if (known !== undefined) return known;
    const parent = parentOf.get(id) ?? null;
    const found = parent === null ? 0 : depth(parent) + 1;
    depths.set(id, found);
    return found;
  };
  for (const { id } of elements) depth(id);
  return depths;
}
