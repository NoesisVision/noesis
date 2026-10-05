import { useState } from 'react';
import { Anchor } from '#/shared/design-system/anchor.tsx';
import classes from './text-spoiler.module.css';

/** The text up to `max` characters, at the last word that fits when there is one. */
const cut = (text: string, max: number): string => {
  const head = text.slice(0, max);
  const space = head.lastIndexOf(' ');
  return (space > 0 ? head.slice(0, space) : head).trimEnd();
};

/**
 * A text folded past `maxLength` characters, with "Show more" at the end of
 * its last line and "Show less" once it is open. Mantine's `Spoiler` folds
 * by height and sets its control below the text; this folds by length and
 * keeps the control in the run of the text. A text that fits is shown as is.
 */
export function TextSpoiler({
  text,
  maxLength,
  className,
}: {
  text: string;
  maxLength: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const classNames = className ? `${classes.text} ${className}` : classes.text;
  if (text.length <= maxLength) {
    return <span className={classNames}>{text}</span>;
  }
  return (
    <span className={classNames}>
      {expanded ? text : `${cut(text, maxLength)}…`}{' '}
      <Anchor
        component="button"
        type="button"
        className={classes.toggle}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Show less' : 'Show more'}
      </Anchor>
    </span>
  );
}
