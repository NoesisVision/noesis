import { z } from 'zod';
import {
  DecisionContextSchema,
  DecisionOptionSchema,
  DecisionStatusSchema,
} from '../decision';
import { ConversationSchema } from './conversation';
import { InformationFragmentRefSchema } from './information-fragment';

/*
 * The payload of a conversation import: what the agent produces when it runs
 * the import-conversation skill, written to a working file and handed to the
 * import tool by path. The service validates it, writes the conversation file,
 * and creates or updates the wiki topics and decisions it names.
 */

export const AnalyzedDecisionSchema = z
  .object({
    id: z
      .string()
      .optional()
      .describe(
        'Leave out for a new decision — the service mints the id. Set it only to update a decision that already exists in the wiki.',
      ),
    title: z.string().describe('The decision in one line, as a heading.'),
    status: DecisionStatusSchema,
    context: DecisionContextSchema,
    decision: DecisionOptionSchema.describe('The option that was chosen.'),
    alternative_options: z
      .array(DecisionOptionSchema)
      .describe('The options that were considered and not chosen.'),
  })
  .describe('A decision found in the source, ready to become a wiki decision.');
export type AnalyzedDecision = z.infer<typeof AnalyzedDecisionSchema>;

export const AnalyzedTopicSchema = z
  .object({
    id: z
      .string()
      .describe(
        'For an existing topic, its id from the wiki. For a new one, any placeholder unique within this payload; the service replaces it.',
      ),
    parent_id: z
      .string()
      .nullable()
      .default(null)
      .describe(
        'The id of the parent topic (an existing one, or a placeholder from this payload), or null for a root.',
      ),
    is_new: z
      .boolean()
      .default(false)
      .describe('True when the topic does not exist in the wiki yet.'),
    title: z.string().describe('The topic title, as a heading.'),
    short_summary: z
      .string()
      .describe('One or two sentences: what the topic is about.'),
    long_summary: z
      .string()
      .describe(
        'The full write-up, merging what this source adds with what the wiki already says. Preserve locked fields of an existing topic.',
      ),
    items: z
      .array(InformationFragmentRefSchema)
      .describe(
        'The fragments of the imported source (and any other source) that ground this topic.',
      ),
    decisions: z
      .array(AnalyzedDecisionSchema)
      .default([])
      .describe('Decisions found in the source that belong to this topic.'),
    reviewed: z
      .boolean()
      .default(false)
      .describe('True once a person has reviewed the summaries.'),
    decisions_extracted: z
      .boolean()
      .default(false)
      .describe('True once decisions have been looked for in this topic.'),
  })
  .describe('One topic the source speaks to, new or existing.');
export type AnalyzedTopic = z.infer<typeof AnalyzedTopicSchema>;

export const ConversationAnalysisSchema = z
  .object({
    conversation: ConversationSchema,
    topics: z
      .array(AnalyzedTopicSchema)
      .describe(
        'Every topic the conversation contributes to, with the fragments that ground it.',
      ),
  })
  .describe(
    'The payload of a conversation import: the conversation itself plus its analysis into topics and decisions.',
  );
export type ConversationAnalysis = z.infer<typeof ConversationAnalysisSchema>;
