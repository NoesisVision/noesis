import type { ChangeId } from '#backend/app/changes/change-id';
import type { DesignDocument } from './design-doc';
import type { DesignDocId } from './design-doc-id';

export interface DesignDocsRepository {
  get(change: ChangeId, id: DesignDocId): Promise<DesignDocument | null>;

  set(
    change: ChangeId,
    id: DesignDocId,
    document: DesignDocument,
  ): Promise<void>;

  /** In no particular order. */
  values(change: ChangeId): AsyncIterable<DesignDocument>;
}
