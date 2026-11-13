import {
  BaseEdge,
  type Edge,
  type EdgeProps,
  EdgeLabelRenderer,
} from '@xyflow/react';
import { clsx } from 'clsx';
import { type CSSProperties } from 'react';
import '@xyflow/react/dist/base.css';
import type { DiagramLine, LineEnd } from './mermaid-graph.ts';
import type { PlacedLine, Point, Rect } from './mermaid-layout.ts';
import classes from './mermaid-canvas.module.css';

/*
 * A line through the points the layout gave it, its corners rounded, its
 * words on it.
 */

export type LineEdge = Edge<
  {
    line: DiagramLine;
    placed: PlacedLine;
    markers: string;
    /** Where it stands to what is in hand; nothing with nothing in hand. */
    tone: 'highlighted' | 'faded' | undefined;
    /** The step being played, its dashes running along it. */
    playing: boolean;
  },
  'line'
>;

/** A line along its route, its corners rounded as the exploration's are. */
function pathThrough(points: Point[], radius = 6): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  let path = `M ${first!.x} ${first!.y}`;
  for (let index = 0; index < rest.length; index++) {
    const at = rest[index]!;
    const next = rest[index + 1];
    const from = points[index]!;
    if (next === undefined) {
      path += ` L ${at.x} ${at.y}`;
      break;
    }
    const into = Math.hypot(at.x - from.x, at.y - from.y);
    const out = Math.hypot(next.x - at.x, next.y - at.y);
    const r = Math.min(radius, into / 2, out / 2);
    const before = {
      x: at.x - ((at.x - from.x) / into) * r,
      y: at.y - ((at.y - from.y) / into) * r,
    };
    const after = {
      x: at.x + ((next.x - at.x) / out) * r,
      y: at.y + ((next.y - at.y) / out) * r,
    };
    path += ` L ${before.x} ${before.y} Q ${at.x} ${at.y} ${after.x} ${after.y}`;
  }
  return path;
}

const labelStyle = (rect: Rect): CSSProperties => ({
  transform: `translate(${rect.x}px, ${rect.y}px)`,
  width: rect.width,
  height: rect.height,
});

export function LineEdgeView({ data }: EdgeProps<LineEdge>) {
  if (data === undefined) return null;
  const { line, placed, markers } = data;
  const className = data.tone === undefined ? undefined : classes[data.tone];
  const tone = data.tone === 'highlighted' ? 'h' : 'n';
  const marker = (end: LineEnd) =>
    end === 'none' ? undefined : `url(#${markers}-${end}-${tone})`;
  return (
    <>
      <BaseEdge
        path={pathThrough(placed.points)}
        markerStart={marker(line.sourceEnd)}
        markerEnd={marker(line.targetEnd)}
      />
      <EdgeLabelRenderer>
        {[
          [line.label, placed.label, classes.label],
          [line.sourceLabel, placed.sourceLabel, classes.endLabel],
          [line.targetLabel, placed.targetLabel, classes.endLabel],
        ].map(([text, rect, kind], index) =>
          text !== null && rect !== null ? (
            <div
              // The line's three labels are its own, by their place.
              // oxlint-disable-next-line react/no-array-index-key
              key={index}
              className={clsx(classes.labelBox, kind as string, className)}
              style={labelStyle(rect as Rect)}
            >
              {text as string}
            </div>
          ) : null,
        )}
      </EdgeLabelRenderer>
    </>
  );
}
