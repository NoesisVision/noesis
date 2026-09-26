import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/model/change-id';
import type { SourceDocument } from '#backend/app/changes/model/source-document';
import { SourceDocumentId } from '#backend/app/changes/model/source-document-id';
import type { Handler } from '#backend/app/handler';
import { type ChangesReader, getChangeOrThrow } from './changes.repository';

/** One source document of a change, whole. */
export const FindSourceDocument = z.object({
  change: ChangeId,
  id: SourceDocumentId,
});
export type FindSourceDocument = z.infer<typeof FindSourceDocument>;

export function findSourceDocumentHandler(
  changes: ChangesReader,
): Handler<FindSourceDocument, SourceDocument> {
  return {
    /** The change is looked up first, so a missing change is the one named. */
    async handle(query) {
      const change = await getChangeOrThrow(changes, query.change);
      return change.sourceDocument(query.id);
    },
  };
}
