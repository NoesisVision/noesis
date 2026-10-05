import { IconChevronRight } from '@tabler/icons-react';
import type { MouseEvent } from 'react';
import classes from './model-tree.module.css';

/**
 * A glyph the pointer can use, and nothing more: the row itself opens and
 * shuts under the arrow keys, and `aria-expanded` on it already says which it
 * is. A named control here would be a second thing to hear on every row for a
 * job the row already does, and a second thing in the row's own name.
 *
 * A row with nothing under it keeps the space, so that every name in a branch
 * starts at the same place.
 */
export function Chevron({
  opens,
  expanded,
  onToggle,
}: {
  opens: boolean;
  expanded: boolean;
  onToggle: (event: MouseEvent<HTMLSpanElement>) => void;
}) {
  return (
    <span
      className={classes.chevron}
      data-opens={opens || undefined}
      data-expanded={expanded || undefined}
      onClick={opens ? onToggle : undefined}
      aria-hidden
    >
      {opens && <IconChevronRight size={13} stroke={2.2} />}
    </span>
  );
}
