/** As long as a store key may be (`KEY_PATTERN`). */
const MAX_LENGTH = 128;

/**
 * The title is the document's identity within its change, so the id is that
 * title as a slug and a retitle is a move.
 */
export function documentIdFromTitle(title: string): string {
  const id = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/, '');
  return id || 'untitled';
}
