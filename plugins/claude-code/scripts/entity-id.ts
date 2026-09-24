// Mints the id of a new change, document or design document: its creation
// date, then its title as a slug. The id is minted once and never changes, so
// run this only for a new entity; to update one, reuse its stored id.
//
//   bun entity-id.ts "<title>"   prints e.g. 2026-09-24-payment-retry
//
// A pure function of the title and the date: it reads nothing from .noesis/.
// The service validates the id and says whether a save created or updated.

/** A whole id fits the 64 characters a path segment gets. */
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

export function entityId(title: string, date: Date): string {
  const slug = slugify(title, MAX_LENGTH - DATE_PREFIX_LENGTH) || 'untitled';
  return `${isoDate(date)}-${slug}`;
}

/** The writer's local calendar date: the day the entity was created on. */
export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
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

if (import.meta.main) {
  const title = process.argv.slice(2).join(' ');
  if (title.trim() === '') {
    console.error('Usage: entity-id.ts "<title>"');
    process.exit(2);
  }
  console.log(entityId(title, new Date()));
}
