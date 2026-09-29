import { z } from 'zod';
import type { DesignDocument } from '#backend/app/design-docs/design-doc';
import {
  DesignDocSummarySchema,
  summarize as summarizeDesignDoc,
} from '#backend/app/design-docs/design-doc-summary';
import type { Handler } from '#backend/app/handler';
import type { Document } from '#backend/app/information-sources/document';
import {
  DocumentSummarySchema,
  summarize as summarizeDocument,
} from '#backend/app/information-sources/document-summary';
import { ChangeSchema } from './change';
import { ChangeId } from './change-id';
import type { ChangeOwnedReader } from './change-owned.repository';
import { type ChangesReader, getChangeOrThrow } from './changes.repository';

/** One change, by its id. */
export const FindChange = z.object({ id: ChangeId });
export type FindChange = z.infer<typeof FindChange>;

/** The change with what it holds summarised, each kind oldest first. */
const ChangeWithChildrenSchema = ChangeSchema.extend({
  designDocs: z.array(DesignDocSummarySchema),
  documents: z.array(DocumentSummarySchema),
});
type ChangeWithChildren = z.infer<typeof ChangeWithChildrenSchema>;

export type FindChangeHandler = Handler<FindChange, ChangeWithChildren>;

export function findChangeHandler(
  changes: ChangesReader,
  designDocs: ChangeOwnedReader<DesignDocument>,
  documents: ChangeOwnedReader<Document>,
): FindChangeHandler {
  return {
    async handle({ id }) {
      const change = await getChangeOrThrow(changes, id);
      const [ownDesignDocs, ownDocuments] = await Promise.all([
        designDocs.list(id),
        documents.list(id),
      ]);
      return {
        ...change,
        designDocs: ownDesignDocs.map(summarizeDesignDoc),
        documents: ownDocuments.map(summarizeDocument),
      };
    },
  };
}
