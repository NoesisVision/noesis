import { type Entity, NotFoundError } from '#backend/app/not-found-error';
import type { ChangeId } from './change-id';
import type { ChangeGuard } from './changes.service';

/** Where an entity a change owns is looked up by its id. */
interface ChangeOwnedLookup<T, Id extends string> {
  get(change: ChangeId, id: Id): Promise<T | null>;
}

/**
 * The entity at `id` in the change. The change is checked first, so a
 * missing change is the one named.
 */
export async function getInChange<T, Id extends string>(
  entities: ChangeOwnedLookup<T, Id>,
  changes: ChangeGuard,
  entity: Entity,
  change: ChangeId,
  id: Id,
): Promise<T> {
  await changes.assertExists(change);
  const found = await entities.get(change, id);
  if (found === null) throw new NotFoundError(entity, id, change);
  return found;
}
