import type { ChangeSlug } from '#backend/app/changes/change-slug';
import type { Document } from '#backend/app/information-sources/model/document';

export interface DocumentsRepository {
  get(slug: ChangeSlug, id: string): Promise<Document | null>;

  set(slug: ChangeSlug, id: string, document: Document): Promise<void>;

  /** `false` when there was nothing to remove. */
  delete(slug: ChangeSlug, id: string): Promise<boolean>;

  /** In no particular order. */
  values(slug: ChangeSlug): AsyncIterable<Document>;

  /** Absolute; touches no file. */
  pathOf(slug: ChangeSlug, id: string): string;
}
