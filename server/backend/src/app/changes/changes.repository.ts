import type { Change } from './change';
import type { ChangeId } from './change-id';

export interface ChangesRepository {
  get(id: ChangeId): Promise<Change | null>;

  /** By id ascending. */
  list(): Promise<Change[]>;

  /** Creates or replaces the change; what it owns stays. */
  save(change: Change): Promise<void>;
}
