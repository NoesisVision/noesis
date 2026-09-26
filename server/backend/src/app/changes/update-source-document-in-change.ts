import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/model/change-id';
import { UpdateSourceDocument } from '#backend/app/changes/model/source-document';
import { SourceDocumentId } from '#backend/app/changes/model/source-document-id';
import {
  type SourceDocumentSummary,
  summarize,
} from '#backend/app/changes/model/source-document-summary';
import type { Handler } from '#backend/app/handler';
import { type ChangesRepository, getChangeOrThrow } from './changes.repository';

/** A new version of a source document. `sourceDocument` is the working file: the id travels beside it. */
export const UpdateSourceDocumentInChange = z.object({
  change: ChangeId,
  id: SourceDocumentId,
  sourceDocument: UpdateSourceDocument,
});
export type UpdateSourceDocumentInChange = z.infer<
  typeof UpdateSourceDocumentInChange
>;

export class UpdateSourceDocumentInChangeHandler implements Handler<
  UpdateSourceDocumentInChange,
  SourceDocumentSummary
> {
  private readonly changes: ChangesRepository;

  constructor(changes: ChangesRepository) {
    this.changes = changes;
  }

  /** Replaces the source document at `id` whole; never creates one. */
  async handle(
    command: UpdateSourceDocumentInChange,
  ): Promise<SourceDocumentSummary> {
    const change = await getChangeOrThrow(this.changes, command.change);
    const revised = change.reviseSourceDocument(
      command.id,
      command.sourceDocument,
    );
    await this.changes.save(change);
    return summarize(revised);
  }
}
