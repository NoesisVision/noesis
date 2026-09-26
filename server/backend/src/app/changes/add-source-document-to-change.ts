import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/model/change-id';
import { CreateSourceDocument } from '#backend/app/changes/model/source-document';
import {
  type SourceDocumentSummary,
  summarize,
} from '#backend/app/changes/model/source-document-summary';
import type { Handler } from '#backend/app/handler';
import { type ChangesRepository, getChangeOrThrow } from './changes.repository';

/** A new source document for the change. `sourceDocument` is the working file: the server mints its id. */
export const AddSourceDocumentToChange = z.object({
  change: ChangeId,
  sourceDocument: CreateSourceDocument,
});
export type AddSourceDocumentToChange = z.infer<
  typeof AddSourceDocumentToChange
>;

export function addSourceDocumentToChangeHandler(
  changes: ChangesRepository,
): Handler<AddSourceDocumentToChange, SourceDocumentSummary> {
  return {
    async handle(command) {
      const change = await getChangeOrThrow(changes, command.change);
      const added = change.addSourceDocument(command.sourceDocument);
      await changes.save(change);
      return summarize(added);
    },
  };
}
