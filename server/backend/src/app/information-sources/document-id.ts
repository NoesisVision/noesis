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

export const DocumentId = Object.assign(documentIdSchema, {
  TITLE_PATTERN: /[A-Za-z0-9]/,
  TITLE_MAX_LENGTH: MAX_LENGTH,
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
