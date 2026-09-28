import { type Entity, NotFoundError } from '#backend/app/not-found-error';
import type { ChangeId } from './change-id';
import { type ChangesReader, getChangeOrThrow } from './changes.repository';

/** One kind of what a change owns — its design documents or its documents. */
export interface ChangeOwnedRepository<T extends { id: string }> {
  get(change: ChangeId, id: T['id']): Promise<T | null>;

  /** By id ascending. */
  list(change: ChangeId): Promise<T[]>;

  /** Writes `entity` where none is yet; `false` when its id is taken. */
  create(change: ChangeId, entity: T): Promise<boolean>;

  /** Replaces the stored entity whole; `false` when there is none. */
  replace(change: ChangeId, entity: T): Promise<boolean>;

  /** `false` when there is none. */
  delete(change: ChangeId, id: T['id']): Promise<boolean>;
}

/** What a query may touch: the methods that read. */
export type ChangeOwnedReader<T extends { id: string }> = Pick<
  ChangeOwnedRepository<T>,
  'get' | 'list'
>;

/**
 * The entity at `id` in the change. The change is looked up first, so a
 * missing change is the one named.
 */
export async function getOwnedOrThrow<T extends { id: string }>(
  owned: ChangeOwnedReader<T>,
  changes: ChangesReader,
  entity: Entity,
  change: ChangeId,
  id: T['id'],
): Promise<T> {
  await getChangeOrThrow(changes, change);
  const found = await owned.get(change, id);
  if (found === null) throw new NotFoundError(entity, id, change);
  return found;
}
