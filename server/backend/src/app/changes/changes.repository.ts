import type { Change } from '#backend/app/changes/model/change';
import type { ChangeSlug } from './change-slug';

export interface ChangesRepository {
  read(slug: ChangeSlug): Promise<Change | null>;

  /** In no particular order. */
  values(): AsyncIterable<Change>;

  /** Creates or replaces the change; what it owns stays. */
  write(change: Change): Promise<void>;
}
