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
  }: Pick<Required<FloatingEdge>['data'], 'orthogonal'> & {
    animated: boolean;
    /** Where the edge stands to the selection; nothing with none in hand. */
    highlight: 'highlighted' | 'faded' | undefined;
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
    // The selection's relations are drawn over the rest.
    zIndex: highlight === 'highlighted' ? 1 : 0,
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
