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
