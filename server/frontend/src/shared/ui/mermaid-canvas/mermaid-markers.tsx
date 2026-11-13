import { type ReactNode } from 'react';
import '@xyflow/react/dist/base.css';
import type { LineEnd } from './mermaid-graph.ts';
import classes from './mermaid-canvas.module.css';

/*
 * The ends a line may have — arrows, open arrows, triangles — in the
 * normal and the highlighted tone.
 */

/** Every kind of line end, as a marker, in the line's colour and the highlight's. */
export function Markers({ id }: { id: string }) {
  const shapes: Record<Exclude<LineEnd, 'none'>, ReactNode> = {
    arrow: <path d="M 0 0 L 10 5 L 0 10 z" className={classes.fill} />,
    openArrow: <path d="M 0 0 L 10 5 L 0 10" className={classes.stroke} />,
    triangle: <path d="M 0 0 L 10 5 L 0 10 z" className={classes.hollow} />,
    circle: <circle cx="5" cy="5" r="4" className={classes.hollow} />,
    cross: <path d="M 1 1 L 9 9 M 9 1 L 1 9" className={classes.stroke} />,
    diamond: <path d="M 0 5 L 5 1 L 10 5 L 5 9 z" className={classes.hollow} />,
    filledDiamond: (
      <path d="M 0 5 L 5 1 L 10 5 L 5 9 z" className={classes.fill} />
    ),
    one: <path d="M 6 0 L 6 10 M 9 0 L 9 10" className={classes.stroke} />,
    zeroOrOne: (
      <>
        <path d="M 9 0 L 9 10" className={classes.stroke} />
        <circle cx="4" cy="5" r="3" className={classes.hollow} />
      </>
    ),
    oneOrMore: (
      <path
        d="M 10 5 L 0 0 M 10 5 L 0 10 M 10 5 L 0 5 M 3 0 L 3 10"
        className={classes.stroke}
      />
    ),
    zeroOrMore: (
      <>
        <path
          d="M 10 5 L 3 0 M 10 5 L 3 10 M 10 5 L 3 5"
          className={classes.stroke}
        />
        <circle cx="2.5" cy="5" r="2.5" className={classes.hollow} />
      </>
    ),
  };
  return (
    <svg className={classes.markers} aria-hidden>
      <defs>
        {(['n', 'h'] as const).map((tone) =>
          Object.entries(shapes).map(([end, shape]) => (
            <marker
              key={`${end}-${tone}`}
              id={`${id}-${end}-${tone}`}
              className={
                tone === 'h' ? classes.markerHighlight : classes.marker
              }
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="11"
              markerHeight="11"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              {shape}
            </marker>
          )),
        )}
      </defs>
    </svg>
  );
}
