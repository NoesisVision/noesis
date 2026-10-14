import { IconPencil, IconUser } from '@tabler/icons-react';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import { HintTooltip } from '#/shared/ui/hint-tooltip.tsx';
import classes from './hover-marks.module.css';

/** What the figure's tooltip, and a screen reader, say of who wrote it. */
const WRITTEN_BY_HUMAN = 'Written by a human';

/**
 * What a text is, shown at its right while it is pointed at: a pencil where
 * it can be written in place, a figure where a human wrote it — the figure
 * says so itself when pointed at. The pencil repeats what the text already
 * is, so assistive technology skips it; who wrote the text it hears. The
 * text it marks lays it out: positioned, and revealing it on hover and focus.
 */
export function HoverMarks({
  editable = false,
  human = false,
}: {
  editable?: boolean;
  human?: boolean;
}) {
  if (!editable && !human) return null;
  return (
    <span className={classes.marks} data-count={editable && human ? 2 : 1}>
      {editable && <IconPencil size={13} stroke={1.8} aria-hidden />}
      {human && (
        <HintTooltip label={WRITTEN_BY_HUMAN}>
          <span className={classes.human}>
            <IconUser size={13} stroke={1.8} aria-hidden />
            <VisuallyHidden>{WRITTEN_BY_HUMAN}</VisuallyHidden>
          </span>
        </HintTooltip>
      )}
    </span>
  );
}
