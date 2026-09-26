import { z } from 'zod';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import { SourceDocumentId } from '#backend/app/information-sources/source-document-id';
import { Change } from './change';

/** One design document or document of a change, as a list of them names it. */
const ChangeEntry = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('design-doc'),
    id: DesignDocId,
    name: z.string(),
  }),
  z.object({
    kind: z.literal('document'),
    id: SourceDocumentId,
    name: z.string(),
  }),
]);
export type ChangeEntry = z.infer<typeof ChangeEntry>;

const ChangeWithEntries = Change.extend({
  entries: z.array(ChangeEntry),
});
export type ChangeWithEntries = z.infer<typeof ChangeWithEntries>;
