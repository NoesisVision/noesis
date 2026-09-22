import type { ChangeSlug } from '#backend/app/changes/change-slug';
import type { DesignDocument } from './design-doc';
import type { DesignDocId } from './design-doc-id';

export interface DesignDocsRepository {
  get(slug: ChangeSlug, id: DesignDocId): Promise<DesignDocument | null>;

  set(
    slug: ChangeSlug,
    id: DesignDocId,
    document: DesignDocument,
  ): Promise<void>;

  /** `false` when there was nothing to remove. */
  delete(slug: ChangeSlug, id: DesignDocId): Promise<boolean>;

  /** In no particular order. */
  values(slug: ChangeSlug): AsyncIterable<DesignDocument>;

  /** Absolute; touches no file. */
  pathOf(slug: ChangeSlug, id: DesignDocId): string;
}
