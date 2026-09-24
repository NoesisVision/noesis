import { z } from 'zod';
import { ChangeId } from './change-id';

// The change's directory also collects its imported conversations, documents
// and design docs.

/** The commit-type vocabulary, with `feature` as the long form of `feat`. */
export const CHANGE_TYPES = ['feature', 'fix', 'improvement', 'chore'] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

/** Order matters: later stages sort after earlier ones. */
export const CHANGE_STATUSES = [
  'discovery',
  'design',
  'implementation',
  'done',
] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

const CHANGE_KEY_PATTERN = /^[A-Z]{2,8}-\d+$/;

export const ChangeSchema = z
  .object({
    id: ChangeId.describe(
      "The change's id: its creation date, then its name as lower-case kebab-case, e.g. '2026-09-24-payment-retry'. Minted once by the writer with the plugin's entity-id.ts script and never changed; saving at an existing id updates that change.",
    ),
    name: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .describe('The human title of the change, as people say it.'),
    key: z
      .string()
      .trim()
      .regex(CHANGE_KEY_PATTERN, 'A key looks like NOE-142')
      .or(z.literal(''))
      .default('')
      .describe(
        'The tracker key the team uses for it, e.g. "NOE-142". Empty when there is none.',
      ),
    type: z
      .enum(CHANGE_TYPES)
      .describe(
        'What kind of change this is: feature (new behaviour), fix (a bug), improvement (better once, no new behaviour), chore (recurring upkeep).',
      ),
    status: z
      .enum(CHANGE_STATUSES)
      .default('discovery')
      .describe(
        'Where the change is in its lifecycle, in order: discovery (understanding the problem), design (shaping the solution), implementation (building it), done. A new change leaves it out; an update carries the value list_changes returned.',
      ),
    description: z
      .string()
      .default('')
      .describe(
        'A paragraph on what the change is about, for the change list.',
      ),
  })
  .describe('One change: the data.json file inside its directory.');
export type Change = z.infer<typeof ChangeSchema>;
