import type { ChangeId } from '#backend/app/changes/change-id';
import type { Document } from './document';
import type { DocumentId } from './document-id';

export interface DocumentsRepository {
  get(change: ChangeId, id: DocumentId): Promise<Document | null>;

  /** By id ascending. */
  list(change: ChangeId): Promise<Document[]>;

  save(change: ChangeId, document: Document): Promise<void>;
}
