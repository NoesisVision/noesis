import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import { getInChange } from '#backend/app/changes/change-owned';
import type { ChangeGuard } from '#backend/app/changes/changes.service';
import type { Handler } from '#backend/app/handler';
import type { Serial } from '#backend/app/serial';
import { type SourceDocument, SourceDocumentFile } from './source-document';
import { SourceDocumentId } from './source-document-id';
import {
  type SourceDocumentSummary,
  summarize,
} from './source-document-summary';
import type { SourceDocumentsRepository } from './source-documents.repository';

/** A new version of a document. `document` is the working file: the id travels beside it. */
export const UpdateSourceDocument = z.object({
  change: ChangeId,
  id: SourceDocumentId,
  document: SourceDocumentFile,
});
export type UpdateSourceDocument = z.infer<typeof UpdateSourceDocument>;

export class UpdateSourceDocumentHandler implements Handler<
  UpdateSourceDocument,
  SourceDocumentSummary
> {
  private readonly docs: SourceDocumentsRepository;
  private readonly changes: ChangeGuard;
  private readonly writes: Serial;

  constructor(
    docs: SourceDocumentsRepository,
    changes: ChangeGuard,
    writes: Serial,
  ) {
    this.docs = docs;
    this.changes = changes;
    this.writes = writes;
  }

  /** Replaces the document at `id` whole; never creates one. */
  handle(command: UpdateSourceDocument): Promise<SourceDocumentSummary> {
    const { change, id, document } = command;
    return this.writes.run(async () => {
      await getInChange(this.docs, this.changes, 'document', change, id);
      const updated: SourceDocument = { id, ...document };
      await this.docs.save(change, updated);
      return summarize(updated);
    });
  }
}
