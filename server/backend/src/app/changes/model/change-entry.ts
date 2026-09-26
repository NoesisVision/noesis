import { z } from 'zod';
import { ChangeSummary } from './change-snapshot';
import { DesignDocSummary } from './design-doc-summary';
import { SourceDocumentId } from './source-document-id';

/** One design document or source document of a change, as a list of them names it. */
const ChangeEntry = z.discriminatedUnion('kind', [
  DesignDocSummary.extend({ kind: z.literal('design-doc') }),
  z.object({
    kind: z.literal('source-document'),
    id: SourceDocumentId,
    name: z.string(),
  }),
]);
export type ChangeEntry = z.infer<typeof ChangeEntry>;

/** A change with the entries it owns, as the change list shows it. */
export const ChangeWithEntries = ChangeSummary.extend({
  entries: z.array(ChangeEntry),
});
export type ChangeWithEntries = z.infer<typeof ChangeWithEntries>;
