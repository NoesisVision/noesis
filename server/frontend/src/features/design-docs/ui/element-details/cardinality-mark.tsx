import { IconQuestionMark } from '@tabler/icons-react';
import { Tooltip } from '#/shared/design-system/tooltip.tsx';
import { VisuallyHidden } from '#/shared/design-system/visually-hidden.tsx';
import type { Cardinality } from '#backend/app/system-model/system-model.ts';
import classes from './cardinality-mark.module.css';

/** What each cardinality but exactly one is marked with, and called. */
const MARKS = {
  '*': {
    // As code writes a list: brackets, empty.
    glyph: '[]',
    word: 'many',
    label: 'Many',
    tip: 'Many · holds any number of these',
  },
  '0..1': {
    Icon: IconQuestionMark,
    word: 'optional',
    label: 'Optional',
    tip: 'Optional · holds one of these or none',
  },
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
 * How many of its type a slot holds, after the type, at the end of its
 * tag: `[]` for many, as code writes a list, and a question mark for
 * optional, as code writes a value that may be missing. A screen reader hears the word after the type: `, many`.
 * Where nothing round it says what the mark means — a slot's popup — it
 * says so itself, on hover (`tip`).
 */
export function CardinalityMark({
  cardinality,
  tip = false,
  tooltipProps,
}: {
  cardinality: MarkedCardinality;
  /** Says what it means on hover. */
  tip?: boolean;
  /**
   * Set on the tooltip itself — a class, data attributes — for a surface
   * that draws it its own way, as a diagram's theme does.
   */
  tooltipProps?: { className?: string } & Record<`data-${string}`, string>;
}) {
  const { word, tip: says } = MARKS[cardinality];
  // An element of the page itself, for the tooltip to hold on to.
  const mark = markIconOf(cardinality);
  return (
    <>
      <VisuallyHidden>{`, ${word}`}</VisuallyHidden>
      {tip ? (
        <Tooltip label={says} openDelay={200} {...tooltipProps}>
          {mark}
        </Tooltip>
      ) : (
        mark
      )}
    </>
  );
}

/** The mark alone: what reads beside it says the rest. */
function markIconOf(cardinality: MarkedCardinality) {
  const mark = MARKS[cardinality];
  return (
    <span className={classes.mark} data-cardinality={cardinality}>
      {'glyph' in mark ? (
        <span className={classes.glyph} aria-hidden>
          {mark.glyph}
        </span>
      ) : (
        <mark.Icon size={11} stroke={2.6} aria-hidden />
      )}
    </span>
  );
}

/**
 * The mark with its word, for a reader who stops on it: `[] Many`. The
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
      {markIconOf(cardinality)}
      <span className={classes.label}>{label}</span>
    </span>
  );
}
