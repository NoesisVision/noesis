import { z } from 'zod';
import type { ChangeId } from '#backend/app/changes/change-id';
import type {
  Added,
  ChangesService,
} from '#backend/app/changes/changes.service';
import { Serial } from '#backend/app/serial';
import type { Document } from './document';
import { DocumentId } from './document-id';
import type { DocumentsRepository } from './documents.repository';

/** What callers get back: plain data, so every adapter can send it as is. */
export const DocumentSummarySchema = z.object({
  id: DocumentId,
  title: z.string().describe('The document title, as stored.'),
  date: z.string().describe('The date on the document, ISO 8601.'),
});
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;

export interface DocumentDetail {
  summary: DocumentSummary;
  document: Document;
}

/** Callers validate before calling in; the id comes with the document. */
export class DocumentsService {
  private readonly docs: DocumentsRepository;
  private readonly changesService: ChangesService;
  private readonly writes = new Serial();

  constructor(docs: DocumentsRepository, changesService: ChangesService) {
    this.docs = docs;
    this.changesService = changesService;
  }

  /**
   * Creates the document, or updates it when its id is already in the
   * change. The lookup and the write run as one step, so parallel adds
   * agree on which of them created it.
   */
  add(change: ChangeId, document: Document): Promise<Added<DocumentSummary>> {
    return this.writes.run(async () => {
      await this.changesService.assertExists(change);
      const created = (await this.docs.get(change, document.id)) === null;
      await this.docs.save(change, document);
      return { value: summarize(document), created };
    });
  }

  /** Oldest first: the id starts with the creation date. */
  async list(change: ChangeId): Promise<DocumentSummary[]> {
    await this.changesService.assertExists(change);
    return (await this.docs.list(change)).map(summarize);
  }

  async findById(
    change: ChangeId,
    id: DocumentId,
  ): Promise<DocumentDetail | null> {
    await this.changesService.assertExists(change);
    const document = await this.docs.get(change, id);
    if (document === null) return null;
    return { summary: summarize(document), document };
  }
}

function summarize({ id, title, date }: Document): DocumentSummary {
  return { id, title, date };
}
