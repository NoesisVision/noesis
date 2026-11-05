import { z } from 'zod';
import { ChangeId } from './change-id';

// The directory named after the change, beside its file, collects its
// documents and design docs.

/** The commit-type vocabulary, with `feature` as the long form of `feat`. */
export const ChangeType = z
  .enum(['feature', 'fix', 'improvement', 'chore'])
  .describe(
    'What kind of change this is: feature (new behavior), fix (a bug), improvement (better once, no new behavior), chore (recurring upkeep).',
  );
export type ChangeType = z.infer<typeof ChangeType>;

/** Order matters: later stages sort after earlier ones. */
export const ChangeStatus = z
  .enum(['discovery', 'design', 'implementation', 'done'])
  .describe(
    'Where the change is in its lifecycle, in order: discovery (understanding the problem), design (shaping the solution), implementation (building it), done. A new change leaves it out and starts in discovery; an update always names it, carrying the value list_changes returned unless the change moves on.',
  );
export type ChangeStatus = z.infer<typeof ChangeStatus>;

const CHANGE_KEY_PATTERN = /^[A-Z]{2,8}-\d+$/;

export const ChangeSchema = z
  .object({
    id: ChangeId.describe(
      "The change's id: its creation date, then its name as lower-case kebab-case, e.g. '2026-09-24-payment-retry'. Minted by the server when the change is created and never changed, even when the name is.",
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
    type: ChangeType,
    status: ChangeStatus,
    description: z
      .string()
      .default('')
      .describe(
        'A paragraph on what the change is about, for the change list.',
      ),
  })
  .describe('One change: graph/changes/<id>.change.json.');
export type Change = z.infer<typeof ChangeSchema>;

/** The working file of a new change: the server mints its id, and it starts in discovery. */
export const NewChangeSchema = ChangeSchema.omit({ id: true, status: true });
export type NewChange = z.infer<typeof NewChangeSchema>;

/** The working file of a change update: the id travels beside it. */
export const ChangeContentSchema = ChangeSchema.omit({ id: true });
