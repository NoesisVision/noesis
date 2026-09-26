import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import type { ChangesService } from '#backend/app/changes/changes.service';
import type { Serial } from '#backend/app/serial';
import { freeSlugId } from '#backend/app/slug-id';
import type { Today } from '#backend/app/today';
import { SourceDocument } from './source-document';
import { SourceDocumentId } from './source-document-id';
import {
  type SourceDocumentSummary,
  summarize,
} from './source-document-summary';
import type { SourceDocumentsRepository } from './source-documents.repository';

/** A new document for the change. `document` is the working file: the server mints its id. */
export const CreateSourceDocument = z.object({
  change: ChangeId,
  document: SourceDocument.omit({ id: true }),
});
export type CreateSourceDocument = z.infer<typeof CreateSourceDocument>;

export class CreateSourceDocumentHandler {
  private readonly docs: Pick<SourceDocumentsRepository, 'get' | 'save'>;
  private readonly changes: Pick<ChangesService, 'assertExists'>;
  private readonly writes: Serial;
  private readonly today: Today;

  constructor(
    docs: Pick<SourceDocumentsRepository, 'get' | 'save'>,
    changes: Pick<ChangesService, 'assertExists'>,
    writes: Serial,
    today: Today,
  ) {
    this.docs = docs;
    this.changes = changes;
    this.writes = writes;
    this.today = today;
  }

  /**
   * Creates the document in the change, at an id minted from today's date
   * and its title. A title already used that day in the change gets the next
   * free suffix.
   */
  execute(command: CreateSourceDocument): Promise<SourceDocumentSummary> {
    const { change, document } = command;
    return this.writes.run(async () => {
      await this.changes.assertExists(change);
      const id = await freeSlugId(
        SourceDocumentId,
        document.title,
        this.today(),
        async (candidate) => (await this.docs.get(change, candidate)) !== null,
      );
      const created: SourceDocument = { id, ...document };
      await this.docs.save(change, created);
      return summarize(created);
    });
  }
}
