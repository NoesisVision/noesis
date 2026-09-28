import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import type { ChangeOwnedRepository } from '#backend/app/changes/change-owned.repository';
import {
  type ChangesReader,
  getChangeOrThrow,
} from '#backend/app/changes/changes.repository';
import type { Handler } from '#backend/app/handler';
import { createAtFreeSlugId } from '#backend/app/slug-id';
import type { Today } from '#backend/app/today';
import { type Document, DocumentContentSchema } from './document';
import { DocumentId } from './document-id';
import { type DocumentSummary, summarize } from './document-summary';

/** A new document for the change. `document` is the working file: the server mints its id. */
export const CreateDocumentInChange = z.object({
  change: ChangeId,
  document: DocumentContentSchema,
});
export type CreateDocumentInChange = z.infer<typeof CreateDocumentInChange>;

export type CreateDocumentInChangeHandler = Handler<
  CreateDocumentInChange,
  DocumentSummary
>;

export function createDocumentInChangeHandler(
  documents: ChangeOwnedRepository<Document>,
  changes: ChangesReader,
  today: Today,
): CreateDocumentInChangeHandler {
  return {
    /**
     * Creates the document in the change, at an id minted from today's date
     * and its title. A title already used that day in the change gets the
     * next free suffix.
     */
    async handle({ change, document }) {
      await getChangeOrThrow(changes, change);
      const at = (id: DocumentId): Document => ({ id, ...document });
      const id = await createAtFreeSlugId(
        DocumentId,
        document.title,
        today(),
        (candidate) => documents.create(change, at(candidate)),
      );
      return summarize(at(id));
    },
  };
}
