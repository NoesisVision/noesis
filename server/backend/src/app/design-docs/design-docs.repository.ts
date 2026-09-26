import type { ChangeId } from '#backend/app/changes/change-id';
import type { DesignDoc } from './design-doc';
import type { DesignDocId } from './design-doc-id';

export interface DesignDocsRepository {
  get(change: ChangeId, id: DesignDocId): Promise<DesignDoc | null>;

  /** By id ascending. */
  list(change: ChangeId): Promise<DesignDoc[]>;

  save(change: ChangeId, document: DesignDoc): Promise<void>;
}
