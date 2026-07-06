// GENERATED from @repo/mcp-contracts — do not edit; run `bun run generate`.
import { z } from 'zod';
import { InformationCategory } from './information-category.js';

export const ConversationFragmentSchema = z.object({
  index: z.int(),
  sentences: z.array(z.string()),
  categories: z.array(InformationCategory),
});
export type ConversationFragment = z.infer<typeof ConversationFragmentSchema>;

export const ConversationFragmentRefSchema = z.object({
  type: z.literal('conversation_fragment_ref'),
  conversation_id: z.string(),
  turn_index: z.int(),
  fragment_index: z.int(),
  source_sha: z
    .string()
    .optional()
    .describe(
      'SHA-256 of the referenced source content at ref-creation time. Used to detect stale references when the source content changes.',
    ),
});
export type ConversationFragmentRef = z.infer<
  typeof ConversationFragmentRefSchema
>;

export const TurnSchema = z.object({
  index: z.int(),
  speaker: z.string(),
  time: z.string(),
  fragments: z.array(ConversationFragmentSchema),
});
export type Turn = z.infer<typeof TurnSchema>;

export const ConversationSchema = z.object({
  conversation_id: z.string(),
  time: z.string(),
  main_topic: z.string(),
  turns: z.array(TurnSchema),
});
export type Conversation = z.infer<typeof ConversationSchema>;
