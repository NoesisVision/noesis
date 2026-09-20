/** As long as a store key may be (`KEY_PATTERN`). */
const MAX_LENGTH = 128;

/**
 * The title is the document's identity within its change, so the id is that
 * title as a slug and a retitle is a move.
 */
export function documentIdFromTitle(title: string): string {
  return slugify(title) || 'untitled';
}

/**
 * False for a title the derivation empties — punctuation or a script with no
 * ASCII in it. Every such title would share the one fallback id, so the
 * contract refuses them instead of letting the second one look like a
 * duplicate of the first.
 */
export function titleYieldsId(title: string): boolean {
  return slugify(title) !== '';
}

function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/, '');
}
