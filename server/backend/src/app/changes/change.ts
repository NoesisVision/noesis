import { z } from 'zod';
import { ChangeId } from './change-id';

// The directory named after the change, beside its file, collects its
// documents and design docs.

/** The commit-type vocabulary, with `feature` as the long form of `feat`. */
export const CHANGE_TYPES = ['feature', 'fix', 'improvement', 'chore'] as const;
export const ChangeType = z.enum(CHANGE_TYPES);
export type ChangeType = z.infer<typeof ChangeType>;

/** Order matters: later stages sort after earlier ones. */
export const CHANGE_STATUSES = [
  'discovery',
  'design',
  'implementation',
  'done',
] as const;
export const ChangeStatus = z.enum(CHANGE_STATUSES);
export type ChangeStatus = z.infer<typeof ChangeStatus>;

const CHANGE_KEY_PATTERN = /^[A-Z]{2,8}-\d+$/;

export const Change = z
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
    type: ChangeType.describe(
      'What kind of change this is: feature (new behaviour), fix (a bug), improvement (better once, no new behaviour), chore (recurring upkeep).',
    ),
    status: ChangeStatus.default('discovery').describe(
      'Where the change is in its lifecycle, in order: discovery (understanding the problem), design (shaping the solution), implementation (building it), done. A new change leaves it out; an update carries the value list_changes returned.',
    ),
    description: z
      .string()
      .default('')
      .describe(
        'A paragraph on what the change is about, for the change list.',
      ),
  })
  .describe('One change: graph/changes/<id>.change.json.');
export type Change = z.infer<typeof Change>;

/** The working file of a new change: the server mints its id, and it starts in discovery. */
export const CreateChange = Change.omit({ id: true, status: true });
export type CreateChange = z.infer<typeof CreateChange>;

/** The working file of a change update: the id travels beside it. */
export const UpdateChange = Change.omit({ id: true });
export type UpdateChange = z.infer<typeof UpdateChange>;
