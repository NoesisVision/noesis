import type { ReactElement } from 'react';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import classes from './hint-tooltip.module.css';

/**
 * A quiet tooltip that says what a piece of text is — that it can be
 * edited, who wrote it — in small type, a step back from the page: a hint,
 * not a message.
 */
export function HintTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
}) {
  return (
    <Tooltip
      label={label}
      openDelay={300}
      classNames={{ tooltip: classes.hint }}
    >
      {children}
    </Tooltip>
  );
}
