import { z } from 'zod';

/*
 * A change: one unit of work tracked across the graph, and the directory
 * `.noesis/changes/<slug>/` that collects everything produced while working on
 * it — imported conversations and documents, and the design docs that
 * describe it. This file is the directory's metadata, stored as
 * `change.json` inside it.
 */

/** The commit-type vocabulary, with `feature` as the long form of `feat`. */
export const CHANGE_TYPES = ['feature', 'fix', 'improvement', 'chore'] as const;
export const ChangeTypeSchema = z
  .enum(CHANGE_TYPES)
  .describe(
    'What kind of change this is: feature (new behaviour), fix (a bug), improvement (better once, no new behaviour), chore (recurring upkeep).',
  );
export type ChangeType = z.infer<typeof ChangeTypeSchema>;

/** Lifecycle order — later stages sort after earlier ones. */
export const CHANGE_STATUSES = [
  'discovery',
  'design',
  'implementation',
  'done',
] as const;
export const ChangeStatusSchema = z
  .enum(CHANGE_STATUSES)
  .describe(
    'Where the change is in its lifecycle, in order: discovery (understanding the problem), design (shaping the solution), implementation (building it), done.',
  );
export type ChangeStatus = z.infer<typeof ChangeStatusSchema>;

export const ChangeSchema = z
  .object({
    slug: z
      .string()
      .describe(
        'The directory name under .noesis/changes/: lower-case kebab-case, at most 64 characters, derived from the name at creation and never changed after.',
      ),
    name: z
      .string()
      .describe('The human title of the change, as people say it.'),
    key: z
      .string()
      .describe(
        'The tracker key the team uses for it, e.g. "NOE-142". Empty when there is none.',
      ),
    type: ChangeTypeSchema,
    status: ChangeStatusSchema,
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
  .describe(
    'Metadata of one change: the change.json file inside its directory.',
  );
export type Change = z.infer<typeof ChangeSchema>;

/** A tracker key: an upper-case project prefix, a dash, a number — `NOE-142`. */
export const CHANGE_KEY_PATTERN = /^[A-Z]{2,8}-\d+$/;

/**
 * What creating a change takes. The slug is derived from the name, the status
 * starts at `discovery` and the creation stamp is the server's, so none of
 * them is part of the request.
 */
export const CreateChangeSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    key: z
      .string()
      .trim()
      .regex(CHANGE_KEY_PATTERN, 'A key looks like NOE-142')
      .or(z.literal(''))
      .default(''),
    type: ChangeTypeSchema,
  })
  .describe('The request body for creating a change.');
export type CreateChange = z.infer<typeof CreateChangeSchema>;
