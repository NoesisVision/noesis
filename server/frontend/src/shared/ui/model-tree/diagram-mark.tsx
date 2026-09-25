import { IconChartDots3 } from '@tabler/icons-react';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import classes from './model-tree.module.css';

/**
 * Says the row draws something, so a reader can find the drawn parts of a
 * design without opening every row. A glyph alone would say it to no one who
 * cannot see it, so the word goes with it.
 */
export function DiagramMark() {
  return (
    <span className={classes.mark}>
      <IconChartDots3 size={14} stroke={1.6} aria-hidden />
      <VisuallyHidden>has a diagram</VisuallyHidden>
    </span>
  );
}
