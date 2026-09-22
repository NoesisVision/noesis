import { err, ok, ResultAsync } from 'neverthrow';
import { z } from 'zod';
import type { ChangeNotFound } from '#backend/app/changes/change-errors';
import type { ChangeSlug } from '#backend/app/changes/change-slug';
import type { ChangesRepository } from '#backend/app/changes/changes.repository';
import { existingChange } from '#backend/app/changes/existing-change';
import { Serial } from '#backend/app/serial';
import type { CreateDocument, Document } from './document';
import {
  type DocumentNotFound,
  type DuplicateDocument,
  documentNotFound,
  duplicateDocument,
} from './document-errors';
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

/**
 * Callers validate before calling in. The title identifies the
 * document within its change, so the service derives the id from it; a title
 * no id can be derived from is a `ValueObjectError`, thrown, since the
 * contract's title pattern rules it out.
 */
export class DocumentsService {
  private readonly docs: DocumentsRepository;
  private readonly changes: ChangesRepository;
  private readonly writes = new Serial();

  constructor(docs: DocumentsRepository, changes: ChangesRepository) {
    this.docs = docs;
    this.changes = changes;
  }

  /** Check and write run as one step, so parallel creates cannot both pass the check. */
  create(
    slug: ChangeSlug,
    document: CreateDocument,
  ): ResultAsync<DocumentSummary, ChangeNotFound | DuplicateDocument> {
    return new ResultAsync(
      this.writes.run(() =>
        existingChange(this.changes, slug).andThen(() => {
          const id = DocumentId.fromTitle(document.title);
          return this.titleFree(slug, id, document.title).andThen(() =>
            this.store(slug, id, document),
          );
        }),
      ),
    );
  }

  /** Whole-document replacement; a new title moves the document to its id. */
  update(
    slug: ChangeSlug,
    id: DocumentId,
    document: CreateDocument,
  ): ResultAsync<
    DocumentSummary,
    ChangeNotFound | DocumentNotFound | DuplicateDocument
  > {
    return new ResultAsync(
      this.writes.run(() =>
        this.existing(slug, id).andThen(() => this.move(slug, id, document)),
      ),
    );
  }

  list(slug: ChangeSlug): ResultAsync<DocumentSummary[], ChangeNotFound> {
    return existingChange(this.changes, slug).map(async () => {
      const documents = await Array.fromAsync(this.docs.values(slug));
      return documents
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || a.title.localeCompare(b.title),
        )
        .map((document) => this.summarize(slug, document));
    });
  }

  findById(
    slug: ChangeSlug,
    id: DocumentId,
  ): ResultAsync<DocumentDetail, ChangeNotFound | DocumentNotFound> {
    return this.existing(slug, id).map((document) => ({
      summary: this.summarize(slug, document),
      document,
    }));
  }

  delete(
    slug: ChangeSlug,
    id: DocumentId,
  ): ResultAsync<void, ChangeNotFound | DocumentNotFound> {
    return this.existing(slug, id).map(async () => {
      await this.docs.delete(slug, id);
    });
  }

  private move(
    slug: ChangeSlug,
    id: DocumentId,
    document: CreateDocument,
  ): ResultAsync<DocumentSummary, DuplicateDocument> {
    const retitled = DocumentId.fromTitle(document.title);
    if (retitled.equals(id)) return this.store(slug, id, document);
    return this.titleFree(slug, retitled, document.title)
      .andThen(() => this.store(slug, retitled, document))
      .map(async (summary) => {
        await this.docs.delete(slug, id);
        return summary;
      });
  }

  private existing(
    slug: ChangeSlug,
    id: DocumentId,
  ): ResultAsync<Document, ChangeNotFound | DocumentNotFound> {
    return existingChange(this.changes, slug)
      .map(() => this.docs.get(slug, id))
      .andThen((document) =>
        document === null ? err(documentNotFound(slug, id)) : ok(document),
      );
  }

  private titleFree(
    slug: ChangeSlug,
    id: DocumentId,
    title: string,
  ): ResultAsync<void, DuplicateDocument> {
    return ResultAsync.fromSafePromise(this.docs.get(slug, id)).andThen(
      (taken) =>
        taken === null ? ok(undefined) : err(duplicateDocument(slug, title)),
    );
  }

  private store(
    slug: ChangeSlug,
    id: DocumentId,
    document: CreateDocument,
  ): ResultAsync<DocumentSummary, never> {
    const stored: Document = { ...document, document_id: id };
    return ResultAsync.fromSafePromise(this.docs.set(slug, id, stored)).map(
      () => this.summarize(slug, stored),
    );
  }

  private summarize(slug: ChangeSlug, document: Document): DocumentSummary {
    const { document_id: id, title, date } = document;
    return { id: id.value, title, date, path: this.docs.pathOf(slug, id) };
  }
}
