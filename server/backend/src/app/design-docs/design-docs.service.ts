import { err, ok, ResultAsync } from 'neverthrow';
import { z } from 'zod';
import type { ChangeNotFound } from '#backend/app/changes/change-errors';
import type { ChangeSlug } from '#backend/app/changes/change-slug';
import type { ChangesRepository } from '#backend/app/changes/changes.repository';
import { existingChange } from '#backend/app/changes/existing-change';
import type { CreateDesignDocument, DesignDocument } from './design-doc';
import { type DesignDocNotFound, designDocNotFound } from './design-doc-errors';
import { DesignDocId } from './design-doc-id';
import type { DesignDocsRepository } from './design-docs.repository';

/** What callers get back: plain data, so every adapter can send it as is. */
export const DesignDocSummarySchema = z.object({
  id: z.string().describe('The design document id, minted by the server.'),
  name: z.string().describe('The design document name, as stored.'),
  implemented: z
    .boolean()
    .describe('Whether the design is marked as implemented.'),
  path: z
    .string()
    .describe(
      'Absolute path the design document was stored at under .noesis/; the agent reads it from there.',
    ),
});
export type DesignDocSummary = z.infer<typeof DesignDocSummarySchema>;

export interface DesignDocDetail {
  summary: DesignDocSummary;
  document: DesignDocument;
}

/**
 * Callers validate before calling in. The server mints the id and
 * replaces whatever the input carries, so an agent inventing a colliding id
 * cannot overwrite another document.
 */
export class DesignDocsService {
  private readonly docs: DesignDocsRepository;
  private readonly changes: ChangesRepository;

  constructor(docs: DesignDocsRepository, changes: ChangesRepository) {
    this.docs = docs;
    this.changes = changes;
  }

  create(
    slug: ChangeSlug,
    document: CreateDesignDocument,
  ): ResultAsync<DesignDocSummary, ChangeNotFound> {
    return existingChange(this.changes, slug).andThen(() =>
      this.store(slug, DesignDocId.mint(), document),
    );
  }

  /** Whole-document replacement. */
  update(
    slug: ChangeSlug,
    id: DesignDocId,
    document: CreateDesignDocument,
  ): ResultAsync<DesignDocSummary, ChangeNotFound | DesignDocNotFound> {
    return this.existing(slug, id).andThen(() =>
      this.store(slug, id, document),
    );
  }

  list(slug: ChangeSlug): ResultAsync<DesignDocSummary[], ChangeNotFound> {
    return existingChange(this.changes, slug).map(async () => {
      const documents = await Array.fromAsync(this.docs.values(slug));
      return documents
        .map((document) => this.summarize(slug, document))
        .sort(
          (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
        );
    });
  }

  findById(
    slug: ChangeSlug,
    id: DesignDocId,
  ): ResultAsync<DesignDocDetail, ChangeNotFound | DesignDocNotFound> {
    return this.existing(slug, id).map((document) => ({
      summary: this.summarize(slug, document),
      document,
    }));
  }

  delete(
    slug: ChangeSlug,
    id: DesignDocId,
  ): ResultAsync<void, ChangeNotFound | DesignDocNotFound> {
    return this.existing(slug, id).map(async () => {
      await this.docs.delete(slug, id);
    });
  }

  private existing(
    slug: ChangeSlug,
    id: DesignDocId,
  ): ResultAsync<DesignDocument, ChangeNotFound | DesignDocNotFound> {
    return existingChange(this.changes, slug)
      .map(() => this.docs.get(slug, id))
      .andThen((document) =>
        document === null ? err(designDocNotFound(slug, id)) : ok(document),
      );
  }

  private store(
    slug: ChangeSlug,
    id: DesignDocId,
    document: CreateDesignDocument,
  ): ResultAsync<DesignDocSummary, never> {
    const stored: DesignDocument = { ...document, id };
    return ResultAsync.fromSafePromise(this.docs.set(slug, id, stored)).map(
      () => this.summarize(slug, stored),
    );
  }

  private summarize(
    slug: ChangeSlug,
    { id, name, implemented }: DesignDocument,
  ): DesignDocSummary {
    return {
      id: id.value,
      name: name.value,
      implemented,
      path: this.docs.pathOf(slug, id),
    };
  }
}
