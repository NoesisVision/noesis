import { z } from 'zod';

// The change's directory also collects its imported conversations, documents
// and design docs (decision D2).

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

export const ChangeSchema = z
  .object({
    slug: z
      .string()
      .describe(
        'The directory name under .noesis/graph/changes/: lower-case kebab-case, at most 64 characters, derived from the name at creation and never changed after.',
      ),
    name: z
      .string()
      .describe('The human title of the change, as people say it.'),
    key: z
      .string()
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
      .describe(
        'Where the change is in its lifecycle, in order: discovery (understanding the problem), design (shaping the solution), implementation (building it), done.',
      ),
    created_at: z
      .string()
      .describe('When the change was created, ISO 8601 with offset.'),
    description: z
      .string()
      .default('')
      .describe(
        'A paragraph on what the change is about, for the change list.',
      ),
  })
  .describe('One change: the data.json file inside its directory.');
export type Change = z.infer<typeof ChangeSchema>;

export const CHANGE_KEY_PATTERN = /^[A-Z]{2,8}-\d+$/;

/** The server sets slug, status (`discovery`) and `created_at`, so the request carries none of them. */
export const CreateChangeSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    key: z
      .string()
      .trim()
      .regex(CHANGE_KEY_PATTERN, 'A key looks like NOE-142')
      .or(z.literal(''))
      .default(''),
    type: z
      .enum(CHANGE_TYPES)
      .describe(
        'What kind of change this is: feature (new behaviour), fix (a bug), improvement (better once, no new behaviour), chore (recurring upkeep).',
      ),
  })
  .describe('The request body for creating a change.');
export type CreateChange = z.infer<typeof CreateChangeSchema>;
