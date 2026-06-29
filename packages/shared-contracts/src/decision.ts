import { z } from 'zod';
import { InformationFragmentRefSchema } from './information-sources/information-fragment.js';

export const DecisionStatusSchema = z.enum([
  'accepted',
  'proposed',
  'deprecated',
  'superseded',
]);
export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;

export const DecisionContextSchema = z.object({
  text: z.string(),
  text_locked: z.boolean().default(false),
  supporting_info: z.array(InformationFragmentRefSchema),
});
export type DecisionContext = z.infer<typeof DecisionContextSchema>;

export const DecisionOptionSchema = z.object({
  text: z.string(),
  text_locked: z.boolean().default(false),
  rationale: z.string(),
  rationale_locked: z.boolean().default(false),
  supporting_info: z.array(InformationFragmentRefSchema),
});
export type DecisionOption = z.infer<typeof DecisionOptionSchema>;

export const DecisionSchema = z.object({
  id: z.string(),
  topic_id: z.string(),
  title: z.string(),
  title_locked: z.boolean().default(false),
  status: DecisionStatusSchema,
  status_locked: z.boolean().default(false),
  context: DecisionContextSchema,
  decision: DecisionOptionSchema,
  alternative_options: z.array(DecisionOptionSchema),
});
export type Decision = z.infer<typeof DecisionSchema>;
