import { NotFoundError } from '#backend/app/not-found-error';
import type { Change } from './change';
import type { ChangeId } from './change-id';

export interface ChangesRepository {
  get(id: ChangeId): Promise<Change | null>;

  /** By id ascending. */
  list(): Promise<Change[]>;

  /**
   * Creates or replaces the change with everything it owns. Throws
   * `ConcurrentModificationError` when the stored change is not the version
   * this one was read at.
   */
  save(change: Change): Promise<void>;
}

/** What a query may touch: the methods that read. */
export type ChangesReader = Pick<ChangesRepository, 'get' | 'list'>;

export async function getChangeOrThrow(
  changes: ChangesReader,
  id: ChangeId,
): Promise<Change> {
  const found = await changes.get(id);
  if (found === null) throw new NotFoundError('change', id);
  return found;
}
