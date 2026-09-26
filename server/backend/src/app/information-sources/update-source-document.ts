import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { NotFoundError } from '#backend/app/not-found-error';
import type { Serial } from '#backend/app/serial';
import { SourceDocument } from './source-document';
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
  document: SourceDocument.omit({ id: true }),
});
export type UpdateSourceDocument = z.infer<typeof UpdateSourceDocument>;

export class UpdateSourceDocumentHandler {
  private readonly docs: Pick<SourceDocumentsRepository, 'get' | 'save'>;
  private readonly changes: Pick<ChangesService, 'assertExists'>;
  private readonly writes: Serial;

  constructor(
    docs: Pick<SourceDocumentsRepository, 'get' | 'save'>,
    changes: Pick<ChangesService, 'assertExists'>,
    writes: Serial,
  ) {
    this.docs = docs;
    this.changes = changes;
    this.writes = writes;
  }

  execute(command: UpdateSourceDocument): Promise<SourceDocumentSummary> {
    const { change, id, document } = command;
    return this.writes.run(async () => {
      // Update never creates: the change, then the document, must exist.
      await this.changes.assertExists(change);
      if ((await this.docs.get(change, id)) === null) {
        throw new NotFoundError('document', id, change);
      }
      const updated: SourceDocument = { id, ...document };
      await this.docs.save(change, updated);
      return summarize(updated);
    });
  }
}
