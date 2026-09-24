import { createContext, useContext } from 'react';

/** What a date arrives as: the graph writes strings, code holds `Date`s. */
export type DateLike = Date | string | number;

/** How much of a date to write — `Intl`'s own four lengths, by its own name. */
export type DateStyle = 'short' | 'medium' | 'long' | 'full';

/** What every date is written at when the caller asks for nothing else. */
const DEFAULT_STYLE: DateStyle = 'medium';

/** How dates read here: the language they are written in, and the writing. */
export interface DateFormat {
  /** What `Intl` settled on, which can be broader than what was asked for. */
  locale: string;
  /**
   * A day as the reader's language writes days; a moment carries its time too.
   * A value that is no date at all is handed back as it came — a list reads
   * better with one odd string in it than not at all.
   */
  format: (value: DateLike, dateStyle?: DateStyle) => string;
}

/** Empty until a provider fills it, so the hook can fall back on the reader. */
export const DateFormatContext = createContext<DateFormat | null>(null);

/** `YYYY-MM-DD`: a day with no time and no zone, as the graph writes them. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The languages the reader asked their browser for, in their own order of
 * preference; `Intl` takes the first it knows. Nothing outside a browser,
 * where `Intl` falls back on the system's own.
 */
function readerLanguages(): string[] {
  return [...(globalThis.navigator?.languages ?? [])];
}

/** Whether the value names a day rather than a moment within one. */
function namesADay(value: DateLike): boolean {
  return typeof value === 'string' && DAY.test(value);
}

function toDate(value: DateLike): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * The same date in the form a machine reads — `<time datetime>`, a sort key —
 * or nothing at all when the value is no date to begin with.
 */
export function isoDate(value: DateLike): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  // A day stays the day it was written as, rather than becoming the moment it
  // was parsed to; the graph already writes both in ISO 8601.
  return typeof value === 'string' ? value : date.toISOString();
}

/**
 * How to write dates in a language, or in the reader's own when none is given.
 *
 * A day is read in UTC deliberately. `2026-09-14` parses as midnight UTC, and
 * in any zone behind UTC that midnight is still the 13th — the date a document
 * carries names a day, not a moment, so it is read in the zone it was parsed
 * in and names the same day everywhere. A moment has a zone of its own and is
 * read in the reader's, with the time it happened at.
 */
export function createDateFormat(
  language?: string | readonly string[],
): DateFormat {
  const languages = language ?? readerLanguages();
  // One `Intl` formatter per length and kind, built the first time a date
  // asks for it rather than once per date in a list of them.
  const formatters = new Map<string, Intl.DateTimeFormat>();
  const formatter = (dateStyle: DateStyle, day: boolean) => {
    const key = `${dateStyle}:${day}`;
    const known = formatters.get(key);
    if (known) return known;

    const built = new Intl.DateTimeFormat(
      languages,
      day ? { dateStyle, timeZone: 'UTC' } : { dateStyle, timeStyle: 'short' },
    );
    formatters.set(key, built);
    return built;
  };

  return {
    locale: formatter(DEFAULT_STYLE, true).resolvedOptions().locale,
    format: (value: DateLike, dateStyle: DateStyle = DEFAULT_STYLE): string => {
      const date = toDate(value);
      if (Number.isNaN(date.getTime())) {
        return typeof value === 'string' ? value : '';
      }
      return formatter(dateStyle, namesADay(value)).format(date);
    },
  };
}

/** The reader's own, worked out once for whatever is drawn without a provider. */
let readerFormat: DateFormat | null = null;

/**
 * How to write a date here: in the language `DateFormatProvider` was given, or
 * in the reader's own for a component drawn outside one, as a test draws them.
 */
export function useDateFormat(): DateFormat {
  const provided = useContext(DateFormatContext);
  if (provided) return provided;
  readerFormat ??= createDateFormat();
  return readerFormat;
}
