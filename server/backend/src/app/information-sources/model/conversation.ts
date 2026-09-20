import { z } from 'zod';
import { InformationCategory } from './information-category';

// Never rewritten after import.

export const ConversationFragmentSchema = z
  .object({
    index: z
      .int()
      .describe('Position of the fragment within its turn, from 0.'),
    sentences: z
      .array(z.string())
      .describe(
        'The sentences of this idea unit, verbatim from the transcript, in order.',
      ),
    categories: z
      .array(InformationCategory)
      .describe(
        'What the fragment does in the conversation; usually one label.',
      ),
  })
  .describe('One idea unit of a turn: a few sentences making one point.');
export type ConversationFragment = z.infer<typeof ConversationFragmentSchema>;

export const TurnSchema = z
  .object({
    index: z
      .int()
      .describe('Position of the turn in the conversation, from 0.'),
    speaker: z.string().describe('Who spoke, as named in the transcript.'),
    time: z
      .string()
      .describe(
        'When the turn was spoken, ISO 8601, or the transcript timestamp when no date is known.',
      ),
    fragments: z
      .array(ConversationFragmentSchema)
      .describe('The idea units of the turn, in order, covering all of it.'),
  })
  .describe('One uninterrupted contribution by one speaker.');
export type Turn = z.infer<typeof TurnSchema>;

export const ConversationSchema = z
  .object({
    conversation_id: z
      .string()
      .describe(
        'The conversation id: a content hash of the transcript, so re-importing the same transcript yields the same id.',
      ),
    time: z.string().describe('When the conversation took place, ISO 8601.'),
    main_topic: z
      .string()
      .describe('One line on what the conversation was mostly about.'),
    turns: z
      .array(TurnSchema)
      .describe('Every turn of the conversation, in order.'),
  })
  .describe(
    'An imported conversation: the data.json of graph/changes/<change>/conversations/<id>/.',
  );
export type Conversation = z.infer<typeof ConversationSchema>;
