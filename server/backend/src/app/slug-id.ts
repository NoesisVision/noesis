import { z } from 'zod';

/** Room for the date prefix inside the 64 characters a path segment gets. */
const MAX_LENGTH = 64;
/** `YYYY-MM-DD-`, before the slug. */
const DATE_PREFIX_LENGTH = 11;
/** Latin letters that NFKD leaves whole, so stripping marks can't reach them. */
const TRANSLITERATIONS: Record<string, string> = {
  ł: 'l',
  ß: 'ss',
  ø: 'o',
  æ: 'ae',
  œ: 'oe',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ı: 'i',
};
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

/**
 * The ids a new entity may take, best first: `date`, then a slug of `title`,
 * e.g. '2026-09-24-payment-retry', then the same with '-2', '-3', … for when
 * an entity of that title was already created that day. Endless: the writer
 * takes the first one its store does not hold. `date` is an ISO date.
 */
export function* slugIdCandidates(
  title: string,
  date: string,
): Generator<string, never> {
  yield `${date}-${slugOf(title, '')}`;
  for (let n = 2; ; n++) {
    yield `${date}-${slugOf(title, `-${n}`)}`;
  }
}

/** The slug of `title`, cut so that it and `suffix` fit beside the date. */
function slugOf(title: string, suffix: string): string {
  const room = MAX_LENGTH - DATE_PREFIX_LENGTH - suffix.length;
  return (slugify(title, room) || 'untitled') + suffix;
}

function slugify(text: string, maxLength: number): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[łßøæœđðþı]/g, (letter) => TRANSLITERATIONS[letter] ?? letter)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/, '');
}

/**
 * The first of `slugIdCandidates` that `isTaken` turns down, as `schema`
 * parses it. The caller runs this and the write that takes the id as one
 * step, so two writers never pick the same one.
 */
export async function freeSlugId<Id extends z.ZodType<string>>(
  schema: Id,
  title: string,
  date: string,
  isTaken: (id: z.output<Id>) => Promise<boolean>,
): Promise<z.output<Id>> {
  const candidates = slugIdCandidates(title, date);
  for (;;) {
    const id = schema.parse(candidates.next().value);
    if (!(await isTaken(id))) return id;
  }
}
