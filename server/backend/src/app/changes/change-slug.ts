import { z } from 'zod';

const MAX_LENGTH = 64;
const changeSlugSchema = z
  .string()
  .max(MAX_LENGTH, `Invalid ChangeSlug: at most ${MAX_LENGTH} characters`)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Invalid ChangeSlug: expected lower-case kebab-case, e.g. 'payment-retry'",
  )
  .describe(
    "A change's slug: lower-case kebab-case of at most 64 characters, e.g. 'payment-retry'. It names the change's directory, so it can never climb out of `.noesis/graph/changes/`.",
  )
  .brand<'ChangeSlug'>();

export const ChangeSlug = Object.assign(changeSlugSchema, {
  fromName: (name: string) =>
    changeSlugSchema.parse(slugify(name, MAX_LENGTH) || 'untitled'),
});
export type ChangeSlug = z.infer<typeof changeSlugSchema>;

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
