import type { ChangeSlug } from '#backend/app/changes/change-slug';
import type { Document } from './document';
import type { DocumentId } from './document-id';

export interface DocumentsRepository {
  get(slug: ChangeSlug, id: DocumentId): Promise<Document | null>;

  set(slug: ChangeSlug, id: DocumentId, document: Document): Promise<void>;

  /** `false` when there was nothing to remove. */
  delete(slug: ChangeSlug, id: DocumentId): Promise<boolean>;

  /** In no particular order. */
  values(slug: ChangeSlug): AsyncIterable<Document>;

  /** Absolute; touches no file. */
  pathOf(slug: ChangeSlug, id: DocumentId): string;
}
