import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import { getInChange } from '#backend/app/changes/change-owned';
import type { ChangeGuard } from '#backend/app/changes/changes.service';
import type { SourceDocument } from './source-document';
import { SourceDocumentId } from './source-document-id';
import type { SourceDocumentsReader } from './source-documents.repository';

/** One document of a change, whole. */
export const FindSourceDocumentById = z.object({
  change: ChangeId,
  id: SourceDocumentId,
});
export type FindSourceDocumentById = z.infer<typeof FindSourceDocumentById>;

/** Only reads: its dependencies are narrowed to the methods that read. */
export class FindSourceDocumentByIdHandler {
  private readonly docs: SourceDocumentsReader;
  private readonly changes: ChangeGuard;

  constructor(docs: SourceDocumentsReader, changes: ChangeGuard) {
    this.docs = docs;
    this.changes = changes;
  }

  handle(query: FindSourceDocumentById): Promise<SourceDocument> {
    return getInChange(
      this.docs,
      this.changes,
      'document',
      query.change,
      query.id,
    );
  }
}
