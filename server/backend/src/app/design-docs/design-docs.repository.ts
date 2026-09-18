import type { DesignDocument } from '../../shared/contracts/index.js';
import type { ChangeSlug } from '../changes/change-slug.js';

/**
 * Where a change's design documents are kept, keyed by document id, as
 * `DesignDocsService` needs them. The composition root supplies the
 * implementation over the change's `design-docs` collection (decision D2).
 */
export interface DesignDocsRepository {
  /** The document, or `null` when the change has none under that id. */
  get(slug: ChangeSlug, id: string): Promise<DesignDocument | null>;

  /** Creates or replaces the document under `id`. */
  set(slug: ChangeSlug, id: string, document: DesignDocument): Promise<void>;

  /** `false` when there was nothing to remove. */
  delete(slug: ChangeSlug, id: string): Promise<boolean>;

  /** The change's documents, in no particular order. */
  values(slug: ChangeSlug): AsyncIterable<DesignDocument>;

  /** The file the document lives in, absolute; touches no file. */
  pathOf(slug: ChangeSlug, id: string): string;
}
