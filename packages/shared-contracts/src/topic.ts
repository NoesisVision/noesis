import { z } from 'zod';
import { InformationFragmentRefSchema } from './information-sources/information-fragment.js';
import { Locked } from './locked.js';

/*
 * A wiki topic: one node of the topic tree under `.noesis/wiki/topics/`, one
 * file per topic. The tree lives in the data — a topic names its parent by
 * id — so reparenting is a one-field edit, not a file move. Summaries are the
 * distillate of the imported sources the topic points at through `items`.
 */

export const TopicSchema = z
  .object({
    id: z.string().describe('The topic id; stable across renames and moves.'),
    parent_id: z
      .string()
      .nullable()
      .default(null)
      .describe('The id of the parent topic, or null for a root of the tree.'),
    title: z.string().describe('The topic title, as a heading.'),
    title_locked: Locked,
    short_summary: z
      .string()
      .describe('One or two sentences: what the topic is about.'),
    short_summary_locked: Locked,
    long_summary: z
      .string()
      .describe(
        'The full write-up of the topic, distilled from its items: what is known, what was decided, what is open.',
      ),
    long_summary_locked: Locked,
    items: z
      .array(InformationFragmentRefSchema)
      .describe(
        'The source fragments this topic is grounded in — conversation and document fragments, in reading order.',
      ),
  })
  .describe(
    'One topic of the wiki: a wiki/topics/<slug>-<id-suffix>.json file.',
  );
export type Topic = z.infer<typeof TopicSchema>;
