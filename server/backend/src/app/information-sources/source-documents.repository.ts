import type { ChangeId } from '#backend/app/changes/change-id';
import type { SourceDocument } from './source-document';
import type { SourceDocumentId } from './source-document-id';

export interface SourceDocumentsRepository {
  get(change: ChangeId, id: SourceDocumentId): Promise<SourceDocument | null>;

  /** By id ascending. */
  list(change: ChangeId): Promise<SourceDocument[]>;

  save(change: ChangeId, document: SourceDocument): Promise<void>;
}
