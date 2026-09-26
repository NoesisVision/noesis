import { z } from 'zod';
import { ChangeId } from './change-id';
import { DesignDoc } from './design-doc';
import { SourceDocument } from './source-document';

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

export const ChangeSnapshot = z
  .object({
    id: ChangeId,
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
    status: ChangeStatus.describe(
      'Where the change is in its lifecycle, in order: discovery (understanding the problem), design (shaping the solution), implementation (building it), done. A new change leaves it out and starts in discovery; an update always names it, carrying the value list_changes returned unless the change moves on.',
    ),
    description: z
      .string()
      .default('')
      .describe(
        'A paragraph on what the change is about, for the change list.',
      ),
    version: z
      .int()
      .positive()
      .describe(
        'How many times the change was saved. A save made on an older version than the stored one is refused.',
      ),
    designDocs: z
      .array(DesignDoc)
      .describe('The design documents of the change.'),
    sourceDocuments: z
      .array(SourceDocument)
      .describe('The source documents that inform the change.'),
  })
  .describe(
    'One change with everything it owns: graph/changes/<id>.change.json.',
  );
export type ChangeSnapshot = z.infer<typeof ChangeSnapshot>;

/** The working file of a new change: the server mints its id, and it starts in discovery. */
export const CreateChange = ChangeSnapshot.pick({
  name: true,
  key: true,
  type: true,
  description: true,
});
export type CreateChange = z.infer<typeof CreateChange>;

/** The working file of a change update: the id travels beside it. */
export const UpdateChange = ChangeSnapshot.pick({
  name: true,
  key: true,
  type: true,
  status: true,
  description: true,
});
export type UpdateChange = z.infer<typeof UpdateChange>;

/** What callers get back of a change itself: plain data, without what it owns. */
export const ChangeSummary = ChangeSnapshot.pick({
  id: true,
  name: true,
  key: true,
  type: true,
  status: true,
  description: true,
});
export type ChangeSummary = z.infer<typeof ChangeSummary>;
