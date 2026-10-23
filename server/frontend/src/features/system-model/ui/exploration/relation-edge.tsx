import {
  BaseEdge,
  type Edge,
  type EdgeProps,
  getBezierPath,
  getSmoothStepPath,
} from '@xyflow/react';
import type { ElkPoint } from 'elkjs/lib/elk.bundled.js';

/*
 * One relation between two cards. Where the layout routed it, it runs the
 * layout's route, at right angles around the cards; once a card is dragged
 * off the place the route was made for, or for an algorithm that routes
 * nothing, React Flow draws it instead — in steps when the reader wants right
 * angles, in a curve when not.
 */

export type RelationEdge = Edge<
  {
    /** The layout's route, start to end; null where it made none or the cards moved. */
    route: ElkPoint[] | null;
    orthogonal: boolean;
  },
  'relation'
>;

export function RelationEdgeView({
  data,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  id,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  markerEnd,
}: EdgeProps<RelationEdge>) {
  const ends = {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  };
  const [path, labelX, labelY] =
    data?.route != null
      ? routed(data.route)
      : data?.orthogonal
        ? getSmoothStepPath({ ...ends, borderRadius: 6 })
        : getBezierPath(ends);
  return (
    <BaseEdge
      id={id}
      label={label}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      markerEnd={markerEnd}
      path={path}
      labelX={labelX}
      labelY={labelY}
    />
  );
}

/** The route as a path, with the point halfway along it for the label. */
function routed(route: ElkPoint[]): [string, number, number] {
  const path = route
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ');
  const segments = route.flatMap((to, index) => {
    const from = index === 0 ? undefined : route[index - 1];
    return from === undefined
      ? []
      : [{ from, to, length: Math.hypot(to.x - from.x, to.y - from.y) }];
  });
  let left = segments.reduce((sum, { length }) => sum + length, 0) / 2;
  for (const { from, to, length } of segments) {
    if (left <= length) {
      const along = length === 0 ? 0 : left / length;
      return [
        path,
        from.x + (to.x - from.x) * along,
        from.y + (to.y - from.y) * along,
      ];
    }
    left -= length;
  }
  const start = route[0] ?? { x: 0, y: 0 };
  return [path, start.x, start.y];
}
