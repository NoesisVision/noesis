import { z } from 'zod';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import { DocumentId } from '#backend/app/information-sources/document-id';
import { ChangeSchema } from './change';

/** One design document or document of a change, as a list of them names it. */
const ChangeEntrySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('design-doc'),
    id: DesignDocId,
    name: z.string(),
  }),
  z.object({ kind: z.literal('document'), id: DocumentId, name: z.string() }),
]);
export type ChangeEntry = z.infer<typeof ChangeEntrySchema>;

const ChangeWithEntriesSchema = ChangeSchema.extend({
  entries: z.array(ChangeEntrySchema),
});
export type ChangeWithEntries = z.infer<typeof ChangeWithEntriesSchema>;
