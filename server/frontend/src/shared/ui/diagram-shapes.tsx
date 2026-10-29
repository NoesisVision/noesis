import type { CSSProperties } from 'react';
import { DIAGRAM_SHAPE } from '#/shared/design-system/theme.ts';
import classes from './diagram-shapes.module.css';

/** The shape a diagram's card takes (diagram-shapes.module.css). */
export type CardShape = 'box' | 'pill' | 'bevel';

/** The class a diagram's card takes for its shape, with `data-shape` and `data-state`. */
export const cardShapeClass = classes.card;

/**
 * The shape of an element's card, on any diagram: a behavior a pill, a
 * value object bevelled, the rest a rounded box.
 */
export function shapeOf(kind: string, pattern: string | null | undefined) {
  if (kind === 'behavior') return 'pill' as const;
  if (pattern === 'value_object') return 'bevel' as const;
  return 'box' as const;
}

/** A bevelled card's face, drawn under its content: its first child. */
export function BevelFace() {
  return <span className={classes.face} data-part="face" aria-hidden />;
}

/**
 * The dashed ring round a bevelled card related to the selection, along its
 * cut corners: the other cards' ring is an outline, which cannot follow a
 * cut corner, so this one is drawn — a polygon the card's size, a little out.
 */
export function BevelRing({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const { bevel, ringOut } = DIAGRAM_SHAPE;
  const cut = bevel + ringOut * Math.tan(Math.PI / 8);
  const w = width + 2 * ringOut;
  const h = height + 2 * ringOut;
  const points = [
    [cut, 0],
    [w - cut, 0],
    [w, cut],
    [w, h - cut],
    [w - cut, h],
    [cut, h],
    [0, h - cut],
    [0, cut],
  ]
    .map((point) => point.join(','))
    .join(' ');
  return (
    <svg
      className={classes.bevelRing}
      data-part="bevel-ring"
      width={w}
      height={h}
      style={{ '--ring-out': ringOut } as CSSProperties}
      aria-hidden
    >
      <polygon points={points} />
    </svg>
  );
}
