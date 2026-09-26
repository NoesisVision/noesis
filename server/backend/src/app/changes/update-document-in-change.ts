import { z } from 'zod';
import type { Handler } from '#backend/app/handler';
import { ChangeId } from './change-id';
import { type ChangesRepository, getChangeOrThrow } from './changes.repository';
import { SourceDocumentFile } from './source-document';
import { SourceDocumentId } from './source-document-id';
import {
  type SourceDocumentSummary,
  summarize,
} from './source-document-summary';

/** A new version of a document. `document` is the working file: the id travels beside it. */
export const UpdateDocumentInChange = z.object({
  change: ChangeId,
  id: SourceDocumentId,
  document: SourceDocumentFile,
});
export type UpdateDocumentInChange = z.infer<typeof UpdateDocumentInChange>;

export class UpdateDocumentInChangeHandler implements Handler<
  UpdateDocumentInChange,
  SourceDocumentSummary
> {
  private readonly changes: ChangesRepository;

  constructor(changes: ChangesRepository) {
    this.changes = changes;
  }

  /** Replaces the document at `id` whole; never creates one. */
  async handle(
    command: UpdateDocumentInChange,
  ): Promise<SourceDocumentSummary> {
    const change = await getChangeOrThrow(this.changes, command.change);
    const revised = change.reviseSourceDocument(command.id, command.document);
    await this.changes.save(change);
    return summarize(revised);
  }
}
