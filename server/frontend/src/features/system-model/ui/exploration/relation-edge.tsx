import {
  BaseEdge,
  type Edge,
  type EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  type InternalNode,
  Position,
  useInternalNode,
} from '@xyflow/react';

/*
 * One relation between two cards, floating: it meets each card where the
 * line between the two cards' centres crosses that card's border, wherever
 * the cards stand, so the edges between two cards go the shortest way
 * round as they are dragged. It runs in steps when the reader wants right
 * angles, in a curve when not, its arrow at the target's border.
 */

export type RelationEdge = Edge<
  {
    orthogonal: boolean;
  },
  'relation'
>;

interface Point {
  x: number;
  y: number;
}

/** Where the line from this card's centre towards the other's crosses its border. */
export function borderTowards(card: InternalNode, other: InternalNode): Point {
  const width = (card.measured.width ?? 0) / 2;
  const height = (card.measured.height ?? 0) / 2;
  const centre = {
    x: card.internals.positionAbsolute.x + width,
    y: card.internals.positionAbsolute.y + height,
  };
  const towards = {
    x: other.internals.positionAbsolute.x + (other.measured.width ?? 0) / 2,
    y: other.internals.positionAbsolute.y + (other.measured.height ?? 0) / 2,
  };
  if (width === 0 || height === 0) return centre;
  // The direction to the other card, scaled so the card's box is a unit
  // square turned on its corner; its edge is then where |u| + |v| is one.
  const u =
    (towards.x - centre.x) / (2 * width) -
    (towards.y - centre.y) / (2 * height);
  const v =
    (towards.x - centre.x) / (2 * width) +
    (towards.y - centre.y) / (2 * height);
  const sum = Math.abs(u) + Math.abs(v);
  if (sum === 0) return centre;
  const a = u / sum;
  const b = v / sum;
  return {
    x: width * (a + b) + centre.x,
    y: height * (b - a) + centre.y,
  };
}

/** Which side of the card a point on its border is on. */
function sideOf(card: InternalNode, point: Point): Position {
  const { x, y } = card.internals.positionAbsolute;
  const width = card.measured.width ?? 0;
  const height = card.measured.height ?? 0;
  if (point.x <= x + 1) return Position.Left;
  if (point.x >= x + width - 1) return Position.Right;
  if (point.y <= y + 1) return Position.Top;
  if (point.y >= y + height - 1) return Position.Bottom;
  return Position.Top;
}

export function RelationEdgeView({
  data,
  source,
  target,
  id,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  markerEnd,
  style,
}: EdgeProps<RelationEdge>) {
  const from = useInternalNode(source);
  const to = useInternalNode(target);
  if (from === undefined || to === undefined) return null;
  const start = borderTowards(from, to);
  const end = borderTowards(to, from);
  const ends = {
    sourceX: start.x,
    sourceY: start.y,
    sourcePosition: sideOf(from, start),
    targetX: end.x,
    targetY: end.y,
    targetPosition: sideOf(to, end),
  };
  const [path, labelX, labelY] = data?.orthogonal
    ? // Turning close to the cards, so two side by side get no stubs.
      getSmoothStepPath({ ...ends, borderRadius: 6, offset: 8 })
    : getBezierPath(ends);
  return (
    <BaseEdge
      id={id}
      label={label}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      markerEnd={markerEnd}
      style={style}
      path={path}
      labelX={labelX}
      labelY={labelY}
    />
  );
}
