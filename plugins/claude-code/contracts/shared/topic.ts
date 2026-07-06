// GENERATED from @repo/mcp-contracts — do not edit; run `bun run generate`.
import { z } from 'zod';
import { InformationFragmentRefSchema } from './information-sources/information-fragment.js';

export const TopicSchema = z.object({
  id: z.string(),
  parent_id: z.string().nullable().default(null),
  title: z.string(),
  title_locked: z.boolean().default(false),
  short_summary: z.string(),
  short_summary_locked: z.boolean().default(false),
  long_summary: z.string(),
  long_summary_locked: z.boolean().default(false),
  items: z.array(InformationFragmentRefSchema),
});
export type Topic = z.infer<typeof TopicSchema>;
