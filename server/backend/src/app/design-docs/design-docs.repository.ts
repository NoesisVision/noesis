import type { ChangeId } from '#backend/app/changes/change-id';
import {
  type ChangesReader,
  getChangeOrThrow,
} from '#backend/app/changes/changes.repository';
import { NotFoundError } from '#backend/app/not-found-error';
import type { DesignDocument } from './design-doc';
import type { DesignDocId } from './design-doc-id';

/** The design documents of each change. */
export interface DesignDocsRepository {
  get(change: ChangeId, id: DesignDocId): Promise<DesignDocument | null>;

  /** By id ascending: oldest first, as the id starts with the creation date. */
  list(change: ChangeId): Promise<DesignDocument[]>;

  /** Writes `designDoc` where none is yet; `false` when its id is taken. */
  create(change: ChangeId, designDoc: DesignDocument): Promise<boolean>;

  /** Replaces the stored design document whole; `false` when there is none. */
  replace(change: ChangeId, designDoc: DesignDocument): Promise<boolean>;
}

/** What a query may touch: the methods that read. */
export type DesignDocsReader = Pick<DesignDocsRepository, 'get' | 'list'>;

/**
 * The design document at `id` in the change. The change is looked up first,
 * so a missing change is the one named.
 */
export async function getDesignDocOrThrow(
  designDocs: DesignDocsReader,
  changes: ChangesReader,
  change: ChangeId,
  id: DesignDocId,
): Promise<DesignDocument> {
  await getChangeOrThrow(changes, change);
  const found = await designDocs.get(change, id);
  if (found === null) throw new NotFoundError('design document', id, change);
  return found;
}
