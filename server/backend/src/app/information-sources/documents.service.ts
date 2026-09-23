import { z } from 'zod';
import type { ChangeSlug } from '#backend/app/changes/change-slug';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { Serial } from '#backend/app/serial';
import type { CreateDocument, Document } from './document';
import { DocumentId } from './document-id';
import type { DocumentsRepository } from './documents.repository';

/** What callers get back: plain data, so every adapter can send it as is. */
export const DocumentSummarySchema = z.object({
  id: z
    .string()
    .describe('The document id, derived from the title within the change.'),
  title: z.string().describe('The document title, as stored.'),
  date: z.string().describe('The date on the document, ISO 8601.'),
  path: z
    .string()
    .describe(
      'Absolute path the document was stored at under .noesis/; the agent reads it from there.',
    ),
});
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;

export interface DocumentDetail {
  summary: DocumentSummary;
  document: Document;
}

export class DocumentNotFoundError extends Error {
  readonly id: DocumentId;

  constructor(slug: ChangeSlug, id: DocumentId) {
    super(`No document ${JSON.stringify(id.value)} in change ${slug.value}.`);
    this.name = 'DocumentNotFoundError';
    this.id = id;
  }
}

export class DuplicateDocumentError extends Error {
  readonly title: string;

  constructor(slug: ChangeSlug, title: string) {
    super(
      `Change ${slug.value} already has a document titled ${JSON.stringify(title)}.`,
    );
    this.name = 'DuplicateDocumentError';
    this.title = title;
  }
}

/**
 * Callers validate before calling in. The title identifies the
 * document within its change, so the service derives the id from it; a title
 * no id can be derived from is a `ValueObjectError`.
 */
export class DocumentsService {
  private readonly docs: DocumentsRepository;
  private readonly changesService: ChangesService;
  private readonly writes = new Serial();

  constructor(docs: DocumentsRepository, changesService: ChangesService) {
    this.docs = docs;
    this.changesService = changesService;
  }

  /** Check and write run as one step, so parallel creates cannot both pass the check. */
  create(slug: ChangeSlug, document: CreateDocument): Promise<DocumentSummary> {
    return this.writes.run(() => this.createUnguarded(slug, document));
  }

  private async createUnguarded(
    slug: ChangeSlug,
    document: CreateDocument,
  ): Promise<DocumentSummary> {
    await this.changesService.assertExists(slug);
    const id = DocumentId.fromTitle(document.title);
    await this.assertTitleFree(slug, id, document.title);
    return this.store(slug, id, document);
  }

  /** Whole-document replacement; a new title moves the document to its id. */
  update(
    slug: ChangeSlug,
    id: DocumentId,
    document: CreateDocument,
  ): Promise<DocumentSummary> {
    return this.writes.run(() => this.updateUnguarded(slug, id, document));
  }

  private async updateUnguarded(
    slug: ChangeSlug,
    id: DocumentId,
    document: CreateDocument,
  ): Promise<DocumentSummary> {
    await this.changesService.assertExists(slug);
    await this.assertExists(slug, id);
    const retitled = DocumentId.fromTitle(document.title);
    if (retitled.equals(id)) return this.store(slug, id, document);
    await this.assertTitleFree(slug, retitled, document.title);
    const summary = await this.store(slug, retitled, document);
    await this.docs.delete(slug, id);
    return summary;
  }

  async list(slug: ChangeSlug): Promise<DocumentSummary[]> {
    await this.changesService.assertExists(slug);
    const documents = await Array.fromAsync(this.docs.values(slug));
    return documents
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || a.title.localeCompare(b.title),
      )
      .map((document) => this.summarize(slug, document));
  }

  async findById(
    slug: ChangeSlug,
    id: DocumentId,
  ): Promise<DocumentDetail | null> {
    await this.changesService.assertExists(slug);
    const document = await this.docs.get(slug, id);
    if (document === null) return null;
    return { summary: this.summarize(slug, document), document };
  }

  async delete(slug: ChangeSlug, id: DocumentId): Promise<boolean> {
    await this.changesService.assertExists(slug);
    return this.docs.delete(slug, id);
  }

  private async assertExists(slug: ChangeSlug, id: DocumentId): Promise<void> {
    if ((await this.docs.get(slug, id)) === null) {
      throw new DocumentNotFoundError(slug, id);
    }
  }

  private async assertTitleFree(
    slug: ChangeSlug,
    id: DocumentId,
    title: string,
  ): Promise<void> {
    if ((await this.docs.get(slug, id)) !== null) {
      throw new DuplicateDocumentError(slug, title);
    }
  }

  private async store(
    slug: ChangeSlug,
    id: DocumentId,
    document: CreateDocument,
  ): Promise<DocumentSummary> {
    const stored = { ...document, document_id: id };
    await this.docs.set(slug, id, stored);
    return this.summarize(slug, stored);
  }

  private summarize(slug: ChangeSlug, document: Document): DocumentSummary {
    const { document_id: id, title, date } = document;
    return { id: id.value, title, date, path: this.docs.pathOf(slug, id) };
  }
}
