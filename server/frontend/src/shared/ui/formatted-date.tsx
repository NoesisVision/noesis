import {
  type DateLike,
  type DateStyle,
  isoDate,
  useDateFormat,
} from './date-format.ts';

interface FormattedDateProps {
  /** A `Date`, a stamp, or ISO 8601: a day (`YYYY-MM-DD`) or a moment. */
  value: DateLike;
  /** How much of the date to write; the same lengths the hook takes. */
  dateStyle?: DateStyle;
}

/**
 * A date as its reader reads it, with the machine-readable value kept in the
 * markup for whatever reads the page rather than looks at it.
 */
export function FormattedDate({ value, dateStyle }: FormattedDateProps) {
  const { format } = useDateFormat();
  const iso = isoDate(value);

  // Nothing to say in `datetime` when the value is no date: the attribute is
  // defined as a date and an empty one would be a lie.
  return <time dateTime={iso || undefined}>{format(value, dateStyle)}</time>;
}
