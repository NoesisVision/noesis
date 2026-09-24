import { type ReactNode, useMemo } from 'react';
import { createDateFormat, DateFormatContext } from './date-format.ts';

interface DateFormatProviderProps {
  /**
   * The reader's language, as one tag (`de-DE`) or several in their order of
   * preference. Left out, as the app leaves it, each reader gets the ones
   * their own browser asks for.
   */
  language?: string | readonly string[];
  children: ReactNode;
}

/**
 * Puts one formatter within reach of every view, rebuilt only when the
 * language changes.
 */
export function DateFormatProvider({
  language,
  children,
}: DateFormatProviderProps) {
  // A list of languages is a new list on every render, so what the memo
  // watches is the languages themselves rather than the array holding them.
  const tags = typeof language === 'string' ? language : language?.join(',');
  const format = useMemo(
    () => createDateFormat(tags === undefined ? undefined : tags.split(',')),
    [tags],
  );

  return <DateFormatContext value={format}>{children}</DateFormatContext>;
}
