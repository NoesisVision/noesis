import { IconAsterisk, IconQuestionMark } from '@tabler/icons-react';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import type { Cardinality } from '#backend/app/system-model/system-model.ts';
import classes from './cardinality-mark.module.css';

/** What each cardinality but exactly one is marked with, and called. */
const MARKS = {
  '*': { Icon: IconAsterisk, word: 'many', label: 'Many' },
  '0..1': { Icon: IconQuestionMark, word: 'optional', label: 'Optional' },
} as const satisfies Partial<Record<Cardinality, unknown>>;

/** The cardinality a slot is marked with: any but exactly one, which goes unmarked. */
export type MarkedCardinality = keyof typeof MARKS;

/** How a marked cardinality is said, `many` or `optional`; nothing for exactly one. */
export const markWordOf = (cardinality: string | null | undefined) =>
  isMarked(cardinality) ? MARKS[cardinality].word : null;

export const isMarked = (
  cardinality: string | null | undefined,
): cardinality is MarkedCardinality =>
  cardinality != null && Object.hasOwn(MARKS, cardinality);

/**
 * How many of its type a slot holds, after the type, as the end of its
 * tag: a solid segment with an asterisk for many, as the model and UML
 * write it, and a question mark for optional, as code writes a value that
 * may be missing. A screen reader hears the word after the type: `, many`.
 */
export function CardinalityMark({
  cardinality,
}: {
  cardinality: MarkedCardinality;
}) {
  const { word } = MARKS[cardinality];
  return (
    <>
      <VisuallyHidden>{`, ${word}`}</VisuallyHidden>
      <MarkIcon cardinality={cardinality} />
    </>
  );
}

/** The mark alone: what reads beside it says the rest. */
function MarkIcon({ cardinality }: { cardinality: MarkedCardinality }) {
  const { Icon } = MARKS[cardinality];
  return (
    <span className={classes.mark} data-cardinality={cardinality}>
      <Icon size={11} stroke={2.6} aria-hidden />
    </span>
  );
}

/**
 * The mark with its word, for a reader who stops on it: `✱ Many`. The
 * tooltip of a marked type says it after the type's name.
 */
export function CardinalityNote({
  cardinality,
}: {
  cardinality: MarkedCardinality;
}) {
  const { label } = MARKS[cardinality];
  return (
    <span className={classes.note}>
      <MarkIcon cardinality={cardinality} />
      <span className={classes.label}>{label}</span>
    </span>
  );
}
