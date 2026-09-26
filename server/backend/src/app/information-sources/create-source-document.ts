import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import type { ChangeGuard } from '#backend/app/changes/changes.service';
import type { Handler } from '#backend/app/handler';
import type { Serial } from '#backend/app/serial';
import { freeSlugId } from '#backend/app/slug-id';
import type { Today } from '#backend/app/today';
import { type SourceDocument, SourceDocumentFile } from './source-document';
import { SourceDocumentId } from './source-document-id';
import {
  type SourceDocumentSummary,
  summarize,
} from './source-document-summary';
import type { SourceDocumentsRepository } from './source-documents.repository';

/** A new document for the change. `document` is the working file: the server mints its id. */
export const CreateSourceDocument = z.object({
  change: ChangeId,
  document: SourceDocumentFile,
});
export type CreateSourceDocument = z.infer<typeof CreateSourceDocument>;

export class CreateSourceDocumentHandler implements Handler<
  CreateSourceDocument,
  SourceDocumentSummary
> {
  private readonly docs: SourceDocumentsRepository;
  private readonly changes: ChangeGuard;
  private readonly writes: Serial;
  private readonly today: Today;

  constructor(
    docs: SourceDocumentsRepository,
    changes: ChangeGuard,
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
  handle(command: CreateSourceDocument): Promise<SourceDocumentSummary> {
    const { change, document } = command;
    return this.writes.run(async () => {
      await this.changes.assertExists(change);
      const id = await freeSlugId(
        SourceDocumentId,
        document.title,
        this.today(),
        (candidate) => this.docs.has(change, candidate),
      );
      const created: SourceDocument = { id, ...document };
      await this.docs.save(change, created);
      return summarize(created);
    });
  }
}
