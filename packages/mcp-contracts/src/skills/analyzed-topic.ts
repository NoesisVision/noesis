import { z } from 'zod';
import {
  DecisionContextSchema,
  DecisionOptionSchema,
  DecisionStatusSchema,
  InformationFragmentRefSchema,
} from '@repo/shared-contracts';
import { newUuid } from '@repo/shared-contracts/uuid';

// Model-facing output of the `analyze-conversation` skill. Skill-output schemas
// are the payloads the model produces, so per OQ-1.1 they live with the other
// MCP/model-facing contracts here, built on the core domain model from
// @repo/shared-contracts.

export const AnalyzedDecisionSchema = z.object({
  id: z.string().default(() => newUuid()),
  title: z.string(),
  status: DecisionStatusSchema,
  context: DecisionContextSchema,
  decision: DecisionOptionSchema,
  alternative_options: z.array(DecisionOptionSchema),
});
export type AnalyzedDecision = z.infer<typeof AnalyzedDecisionSchema>;

export const AnalyzedTopicSchema = z.object({
  id: z.string(),
  parent_id: z.string().nullable().default(null),
  is_new: z.boolean().default(false),
  title: z.string(),
  short_summary: z.string(),
  long_summary: z.string(),
  items: z.array(InformationFragmentRefSchema),
  decisions: z.array(AnalyzedDecisionSchema).default(() => []),
  reviewed: z.boolean().default(false),
  decisions_extracted: z.boolean().default(false),
});
export type AnalyzedTopic = z.infer<typeof AnalyzedTopicSchema>;
