import type { ReactNode } from 'react';
import type { OutlineChange } from './model-outline.ts';
import classes from './model-tree.module.css';

/*
 * What the design does to a row, as a mark on the corner of its icon: a plus
 * for added, a dot for modified, an x for removed. The shape says it as
 * well as the colour does, so the colour is never the only thing that tells
 * the three apart. Drawn in the change's own colour, ringed in the page's so
 * it stands clear of the icon under it. An element left alone has no mark.
 *
 * Decorative: the element's change badge, in the detail panel, says it in
 * words.
 */
// A filled cross rather than two strokes, so it takes the same ring.
const CROSS = 'M3.5 1.5h2v2h2v2h-2v2h-2v-2h-2v-2h2z';
// As long, with narrower arms: the removed mark's, which is turned into an x.
const THIN_CROSS =
  'M3.75 1.5h1.5v2.25h2.25v1.5h-2.25v2.25h-1.5v-2.25h-2.25v-1.5h2.25z';

const SHAPES: Record<Exclude<OutlineChange, 'unchanged'>, ReactNode> = {
  added: <path d={CROSS} />,
  modified: <circle cx="4.5" cy="4.5" r="2.5" />,
  // A thinner cross, turned on its centre and drawn a little larger: turned,
  // its arms run corner to corner and read smaller than the plus. The ring
  // stays the width it is on the others.
  removed: (
    <path
      d={THIN_CROSS}
      transform="translate(4.5 4.5) rotate(45) scale(1.1) translate(-4.5 -4.5)"
      vectorEffect="non-scaling-stroke"
    />
  ),
};

export function ChangeMark({
  change,
  color,
  children,
}: {
  change: OutlineChange;
  color: string | undefined;
  children: ReactNode;
}) {
  // Wrapped either way, so every icon in the tree sits in the same place.
  return (
    <span className={classes.changeMark}>
      {children}
      {change !== 'unchanged' && (
        <svg
          className={classes.changeMarkShape}
          viewBox="0 0 9 9"
          width={9}
          height={9}
          style={{ color }}
          aria-hidden
        >
          {SHAPES[change]}
        </svg>
      )}
    </span>
  );
}
