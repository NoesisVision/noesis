import type { ChangeId } from '#backend/app/changes/change-id';
import type { SourceDocument } from './source-document';
import type { SourceDocumentId } from './source-document-id';

export interface SourceDocumentsRepository {
  get(change: ChangeId, id: SourceDocumentId): Promise<SourceDocument | null>;

  has(change: ChangeId, id: SourceDocumentId): Promise<boolean>;

  /** By id ascending. */
  list(change: ChangeId): Promise<SourceDocument[]>;

  save(change: ChangeId, document: SourceDocument): Promise<void>;
}

/** What a query may touch: the methods that read. */
export type SourceDocumentsReader = Pick<
  SourceDocumentsRepository,
  'get' | 'has' | 'list'
>;
