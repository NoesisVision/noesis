import { z } from 'zod';
import { InformationFragmentRefSchema } from '../../information-sources/model/information-fragment';
import { Locked } from './locked';

// The tree lives in `parent_id`, so reparenting is a one-field edit, not a file move.

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
  .describe('One topic of the wiki: the data.json of graph/wiki/topics/<id>/.');
export type Topic = z.infer<typeof TopicSchema>;
