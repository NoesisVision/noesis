import { z } from 'zod';

/** As long as a store key may be (`KEY_PATTERN`). */
const MAX_LENGTH = 128;
const documentIdSchema = z
  .string()
  .max(MAX_LENGTH, `Invalid DocumentId: at most ${MAX_LENGTH} characters`)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Invalid DocumentId: expected lower-case kebab-case, e.g. 'payment-retry'",
  )
  .describe(
    "A document's id within its change: its title as a lower-case kebab-case slug of at most 128 characters, e.g. 'payment-retry'. It can never climb out of its change's `documents/`.",
  )
  .brand<'DocumentId'>();

/**
 * The title is the document's identity within its change, so the id is that
 * title as a slug and a retitle is a move.
 */
export const DocumentId = Object.assign(documentIdSchema, {
  /**
   * What a title must match for an id to be derivable from it: one ASCII
   * letter or digit is what the derivation is sure to keep. Narrower than the
   * derivation itself — `É` alone would slug to `e` — so that the rule is one
   * a schema can state.
   */
  TITLE_PATTERN: /[A-Za-z0-9]/,
  /**
   * The id's own limit, so the derivation does not cut a title short and two
   * long titles cannot meet in one id. The cut in `fromTitle` stays for the
   * few characters NFKD expands (`ﬁ` becomes `fi`).
   */
  TITLE_MAX_LENGTH: MAX_LENGTH,
  /**
   * Throws for a title the derivation empties — punctuation or a script with
   * no ASCII in it. There is no fallback id: every such title would share it,
   * and the second one would look like a duplicate of the first. Never throws
   * for a title matching `TITLE_PATTERN`.
   */
  fromTitle: (title: string) =>
    documentIdSchema.parse(slugify(title, MAX_LENGTH)),
});
export type DocumentId = z.infer<typeof documentIdSchema>;

function slugify(text: string, maxLength: number): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/, '');
}
