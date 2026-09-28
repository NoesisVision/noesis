import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import type { ChangeOwnedRepository } from '#backend/app/changes/change-owned.repository';
import {
  type ChangesReader,
  getChangeOrThrow,
} from '#backend/app/changes/changes.repository';
import type { Handler } from '#backend/app/handler';
import { NotFoundError } from '#backend/app/not-found-error';
import { type Document, DocumentContentSchema } from './document';
import { DocumentId } from './document-id';
import { type DocumentSummary, summarize } from './document-summary';

/** A new version of a document. `document` is the working file: the id travels beside it. */
export const UpdateDocumentInChange = z.object({
  change: ChangeId,
  id: DocumentId,
  document: DocumentContentSchema,
});
export type UpdateDocumentInChange = z.infer<typeof UpdateDocumentInChange>;

export type UpdateDocumentInChangeHandler = Handler<
  UpdateDocumentInChange,
  DocumentSummary
>;

export function updateDocumentInChangeHandler(
  documents: ChangeOwnedRepository<Document>,
  changes: ChangesReader,
): UpdateDocumentInChangeHandler {
  return {
    /** Replaces the document at `id` whole; never creates one. */
    async handle({ change, id, document }) {
      await getChangeOrThrow(changes, change);
      const updated: Document = { id, ...document };
      if (!(await documents.replace(change, updated))) {
        throw new NotFoundError('document', id, change);
      }
      return summarize(updated);
    },
  };
}
