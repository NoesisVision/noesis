import { z } from 'zod';
import { InformationFragmentRefSchema } from './information-sources/information-fragment.js';
import { Locked } from './locked.js';

/*
 * A wiki decision: a choice the team made, with the options it was made
 * against and the source fragments that support each side. One file per
 * decision under `.noesis/wiki/decisions/`; a decision names its topic by id.
 */

export const DecisionStatusSchema = z
  .enum(['accepted', 'proposed', 'deprecated', 'superseded'])
  .describe(
    'accepted: in force; proposed: under discussion; deprecated: no longer followed, with no replacement; superseded: replaced by a later decision.',
  );
export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;

export const DecisionContextSchema = z
  .object({
    text: z
      .string()
      .describe(
        'The situation that called for a decision: the forces, constraints and the problem as it stood.',
      ),
    text_locked: Locked,
    supporting_info: z
      .array(InformationFragmentRefSchema)
      .describe('Source fragments that establish the context.'),
  })
  .describe('Why a decision had to be made.');
export type DecisionContext = z.infer<typeof DecisionContextSchema>;

export const DecisionOptionSchema = z
  .object({
    text: z
      .string()
      .describe('The option, stated as the course of action it is.'),
    text_locked: Locked,
    rationale: z
      .string()
      .describe(
        'Why this option was chosen, or for an alternative, why it was not.',
      ),
    rationale_locked: Locked,
    supporting_info: z
      .array(InformationFragmentRefSchema)
      .describe('Source fragments where this option was argued.'),
  })
  .describe('One course of action, chosen or rejected.');
export type DecisionOption = z.infer<typeof DecisionOptionSchema>;

export const DecisionSchema = z
  .object({
    id: z.string().describe('The decision id; stable across edits.'),
    topic_id: z
      .string()
      .describe('The id of the wiki topic this decision belongs to.'),
    title: z.string().describe('The decision in one line, as a heading.'),
    title_locked: Locked,
    status: DecisionStatusSchema,
    status_locked: Locked,
    context: DecisionContextSchema,
    decision: DecisionOptionSchema.describe('The option that was chosen.'),
    alternative_options: z
      .array(DecisionOptionSchema)
      .describe('The options that were considered and not chosen.'),
  })
  .describe(
    'One decision of the wiki: a wiki/decisions/<slug>-<id-suffix>.json file.',
  );
export type Decision = z.infer<typeof DecisionSchema>;
