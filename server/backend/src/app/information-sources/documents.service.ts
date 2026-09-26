import { z } from 'zod';
import type { ChangeId } from '#backend/app/changes/change-id';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { NotFoundError } from '#backend/app/not-found-error';
import { Serial } from '#backend/app/serial';
import { freeSlugId } from '#backend/app/slug-id';
import type { Today } from '#backend/app/today';
import type { Document, DocumentContent } from './document';
import { DocumentId } from './document-id';
import type { DocumentsRepository } from './documents.repository';

/** What callers get back: plain data, so every adapter can send it as is. */
export const DocumentSummarySchema = z.object({
  id: DocumentId,
  title: z.string().describe('The document title, as stored.'),
  date: z.string().describe('The date on the document, ISO 8601.'),
});
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;

/**
 * Callers validate before calling in. The service mints the id of a new
 * document; an update names it.
 */
export class DocumentsService {
  private readonly docs: DocumentsRepository;
  private readonly changesService: ChangesService;
  private readonly today: Today;
  private readonly writes = new Serial();

  constructor(
    docs: DocumentsRepository,
    changesService: ChangesService,
    today: Today,
  ) {
    this.docs = docs;
    this.changesService = changesService;
    this.today = today;
  }

  /**
   * Creates the document in the change, at an id minted from today's date
   * and its title. A title already used that day in the change gets the next
   * free suffix.
   */
  create(
    change: ChangeId,
    document: DocumentContent,
  ): Promise<DocumentSummary> {
    return this.writes.run(async () => {
      await this.changesService.assertExists(change);
      const id = await freeSlugId(
        DocumentId,
        document.title,
        this.today(),
        async (candidate) => (await this.docs.get(change, candidate)) !== null,
      );
      const created: Document = { id, ...document };
      await this.docs.save(change, created);
      return summarize(created);
    });
  }

  /** Replaces the document at `id` whole; never creates one. */
  update(
    change: ChangeId,
    id: DocumentId,
    document: DocumentContent,
  ): Promise<DocumentSummary> {
    return this.writes.run(async () => {
      await this.getOrThrow(change, id);
      const updated: Document = { id, ...document };
      await this.docs.save(change, updated);
      return summarize(updated);
    });
  }

  /** Oldest first: the id starts with the creation date. */
  async list(change: ChangeId): Promise<DocumentSummary[]> {
    await this.changesService.assertExists(change);
    return (await this.docs.list(change)).map(summarize);
  }

  findById(change: ChangeId, id: DocumentId): Promise<Document> {
    return this.getOrThrow(change, id);
  }

  /** The change is checked first, so a missing change is the one named. */
  private async getOrThrow(
    change: ChangeId,
    id: DocumentId,
  ): Promise<Document> {
    await this.changesService.assertExists(change);
    const document = await this.docs.get(change, id);
    if (document === null) throw new NotFoundError('document', id, change);
    return document;
  }
}

function summarize({ id, title, date }: Document): DocumentSummary {
  return { id, title, date };
}
