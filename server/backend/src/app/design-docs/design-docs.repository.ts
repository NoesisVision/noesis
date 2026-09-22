import type { ChangeSlug } from '#backend/app/changes/change-slug';
import type { DesignDocument, DesignDocumentInput } from './design-doc';

export interface DesignDocsRepository {
  get(slug: ChangeSlug, id: string): Promise<DesignDocument | null>;

  /** Takes the JSON form; the store validates and decodes on read. */
  set(
    slug: ChangeSlug,
    id: string,
    document: DesignDocumentInput,
  ): Promise<void>;

  /** `false` when there was nothing to remove. */
  delete(slug: ChangeSlug, id: string): Promise<boolean>;

  /** In no particular order. */
  values(slug: ChangeSlug): AsyncIterable<DesignDocument>;

  /** Absolute; touches no file. */
  pathOf(slug: ChangeSlug, id: string): string;
}
