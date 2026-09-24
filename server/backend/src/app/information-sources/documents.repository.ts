import type { ChangeId } from '#backend/app/changes/change-id';
import type { Document } from './document';
import type { DocumentId } from './document-id';

export interface DocumentsRepository {
  get(change: ChangeId, id: DocumentId): Promise<Document | null>;

  set(change: ChangeId, id: DocumentId, document: Document): Promise<void>;

  /** In no particular order. */
  values(change: ChangeId): AsyncIterable<Document>;
}
