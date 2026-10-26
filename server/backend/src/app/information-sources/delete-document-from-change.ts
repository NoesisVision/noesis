import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import {
  type ChangesReader,
  getChangeOrThrow,
} from '#backend/app/changes/changes.repository';
import type { Handler } from '#backend/app/handler';
import { NotFoundError } from '#backend/app/not-found-error';
import { DocumentId } from './document-id';
import type { DocumentsRepository } from './documents.repository';

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
  documents: DocumentsRepository,
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
