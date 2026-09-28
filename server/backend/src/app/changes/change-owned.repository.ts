import type { ChangeId } from './change-id';

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
