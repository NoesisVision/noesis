import { NotFoundError } from '#backend/app/not-found-error';
import type { Change } from './change';
import type { ChangeId } from './change-id';

export interface ChangesRepository {
  get(id: ChangeId): Promise<Change | null>;

  /** By id ascending. */
  list(): Promise<Change[]>;

  /** Writes `change` where none is yet; `false` when its id is taken. */
  create(change: Change): Promise<boolean>;

  /** Replaces the stored change whole, what it owns aside; `false` when there is none. */
  replace(change: Change): Promise<boolean>;
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
