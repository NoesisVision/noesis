import type { Change } from './change';
import type { ChangeId } from './change-id';

export interface ChangesRepository {
  read(id: ChangeId): Promise<Change | null>;

  /** In no particular order. */
  values(): AsyncIterable<Change>;

  /** Creates or replaces the change; what it owns stays. */
  write(change: Change): Promise<void>;
}
