import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { NotFoundError } from '#backend/app/not-found-error';
import type { SourceDocument } from './source-document';
import { SourceDocumentId } from './source-document-id';
import type { SourceDocumentsRepository } from './source-documents.repository';

/** One document of a change, whole. */
export const FindSourceDocumentById = z.object({
  change: ChangeId,
  id: SourceDocumentId,
});
export type FindSourceDocumentById = z.infer<typeof FindSourceDocumentById>;

/** Only reads: its dependencies are narrowed to the methods that read. */
export class FindSourceDocumentByIdHandler {
  private readonly docs: Pick<SourceDocumentsRepository, 'get'>;
  private readonly changes: Pick<ChangesService, 'assertExists'>;

  constructor(
    docs: Pick<SourceDocumentsRepository, 'get'>,
    changes: Pick<ChangesService, 'assertExists'>,
  ) {
    this.docs = docs;
    this.changes = changes;
  }

  /** The change is checked first, so a missing change is the one named. */
  async handle(query: FindSourceDocumentById): Promise<SourceDocument> {
    await this.changes.assertExists(query.change);
    const document = await this.docs.get(query.change, query.id);
    if (document === null) {
      throw new NotFoundError('document', query.id, query.change);
    }
    return document;
  }
}
