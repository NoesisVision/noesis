import { z } from 'zod';

/** Room for the date prefix inside the 64 characters a path segment gets. */
const MAX_LENGTH = 64;
/** Zod's own `z.iso.date()` regex, leap years included, without its anchors. */
const DATE = z.core.regexes.date.source.slice(1, -1);
const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';
const ID_PATTERN = new RegExp(`^${DATE}-${SLUG}$`);

/**
 * The schema of an id a writer mints from an entity's creation date and title.
 * Only `[a-z0-9-]`, so an id can never climb out of its directory.
 */
export function slugIdSchema(subject: string) {
  return z
    .string()
    .max(MAX_LENGTH, `Invalid ${subject} id: at most ${MAX_LENGTH} characters`)
    .regex(
      ID_PATTERN,
      `Invalid ${subject} id: expected e.g. '2026-09-24-payment-retry'`,
    )
    .describe(
      `A ${subject}'s id: its creation date, then its title as lower-case kebab-case, e.g. '2026-09-24-payment-retry'. Names its file.`,
    );
}
