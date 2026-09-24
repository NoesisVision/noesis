import type { ChangeId } from '#backend/app/changes/change-id';
import type { DesignDocument } from './design-doc';
import type { DesignDocId } from './design-doc-id';

export interface DesignDocsRepository {
  get(change: ChangeId, id: DesignDocId): Promise<DesignDocument | null>;

  /** By id ascending. */
  list(change: ChangeId): Promise<DesignDocument[]>;

  save(change: ChangeId, document: DesignDocument): Promise<void>;
}
