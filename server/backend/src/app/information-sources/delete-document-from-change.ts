import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import type { ChangeOwnedRepository } from '#backend/app/changes/change-owned.repository';
import {
  type ChangesReader,
  getChangeOrThrow,
} from '#backend/app/changes/changes.repository';
import type { Handler } from '#backend/app/handler';
import { NotFoundError } from '#backend/app/not-found-error';
import type { Document } from './document';
import { DocumentId } from './document-id';

/** A document to remove from its change. */
export const DeleteDocumentFromChange = z.object({
  change: ChangeId,
  id: DocumentId,
});
export type DeleteDocumentFromChange = z.infer<typeof DeleteDocumentFromChange>;

export type DeleteDocumentFromChangeHandler = Handler<
  DeleteDocumentFromChange,
  void
>;

export function deleteDocumentFromChangeHandler(
  documents: ChangeOwnedRepository<Document>,
  changes: ChangesReader,
): DeleteDocumentFromChangeHandler {
  return {
    /** Refuses an id that names no document in the change. */
    async handle({ change, id }) {
      await getChangeOrThrow(changes, change);
      if (!(await documents.delete(change, id))) {
        throw new NotFoundError('document', id, change);
      }
    },
  };
}
