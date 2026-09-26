import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/model/change-id';
import { SourceDocumentFile } from '#backend/app/changes/model/source-document';
import {
  type SourceDocumentSummary,
  summarize,
} from '#backend/app/changes/model/source-document-summary';
import type { Handler } from '#backend/app/handler';
import type { Today } from '#backend/app/today';
import { type ChangesRepository, getChangeOrThrow } from './changes.repository';

/** A new document for the change. `document` is the working file: the server mints its id. */
export const AddDocumentToChange = z.object({
  change: ChangeId,
  document: SourceDocumentFile,
});
export type AddDocumentToChange = z.infer<typeof AddDocumentToChange>;

export class AddDocumentToChangeHandler implements Handler<
  AddDocumentToChange,
  SourceDocumentSummary
> {
  private readonly changes: ChangesRepository;
  private readonly today: Today;

  constructor(changes: ChangesRepository, today: Today) {
    this.changes = changes;
    this.today = today;
  }

  async handle(command: AddDocumentToChange): Promise<SourceDocumentSummary> {
    const change = await getChangeOrThrow(this.changes, command.change);
    const added = change.addSourceDocument(command.document, this.today());
    await this.changes.save(change);
    return summarize(added);
  }
}
