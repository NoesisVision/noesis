import type { ChangeId } from '#backend/app/changes/change-id';
import {
  type ChangesReader,
  getChangeOrThrow,
} from '#backend/app/changes/changes.repository';
import { NotFoundError } from '#backend/app/not-found-error';
import type { Document } from './document';
import type { DocumentId } from './document-id';

/** The documents of each change. */
export interface DocumentsRepository {
  get(change: ChangeId, id: DocumentId): Promise<Document | null>;

  /** By id ascending: oldest first, as the id starts with the creation date. */
  list(change: ChangeId): Promise<Document[]>;

  /** Writes `document` where none is yet; `false` when its id is taken. */
  create(change: ChangeId, document: Document): Promise<boolean>;

  /** Replaces the stored document whole; `false` when there is none. */
  replace(change: ChangeId, document: Document): Promise<boolean>;

  /** `false` when there is none. */
  delete(change: ChangeId, id: DocumentId): Promise<boolean>;
}

/** What a query may touch: the methods that read. */
export type DocumentsReader = Pick<DocumentsRepository, 'get' | 'list'>;

/**
 * The document at `id` in the change. The change is looked up first, so a
 * missing change is the one named.
 */
export async function getDocumentOrThrow(
  documents: DocumentsReader,
  changes: ChangesReader,
  change: ChangeId,
  id: DocumentId,
): Promise<Document> {
  await getChangeOrThrow(changes, change);
  const found = await documents.get(change, id);
  if (found === null) throw new NotFoundError('document', id, change);
  return found;
}
