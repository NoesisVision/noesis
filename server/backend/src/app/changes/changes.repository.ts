import type { Change } from '#backend/shared/contracts';
import type { ChangeSlug } from './change-slug';

/**
 * Where the changes of this checkout are kept, as `ChangesService` needs
 * them. The composition root supplies the implementation over the
 * `.noesis/graph/changes` collection (decision D2).
 */
export interface ChangesRepository {
  /** The change, or `null` when there is none under that slug. */
  read(slug: ChangeSlug): Promise<Change | null>;

  /** Every change, in no particular order. */
  values(): AsyncIterable<Change>;

  /** Creates or replaces the change; what it owns stays. */
  write(change: Change): Promise<void>;
}
