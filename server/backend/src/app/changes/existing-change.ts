import { err, ok, ResultAsync } from 'neverthrow';
import type { Change } from './change';
import { type ChangeNotFound, changeNotFound } from './change-errors';
import type { ChangeSlug } from './change-slug';
import type { ChangesRepository } from './changes.repository';

/** The change `slug` names: where every call scoped to a change starts. */
export function existingChange(
  changes: ChangesRepository,
  slug: ChangeSlug,
): ResultAsync<Change, ChangeNotFound> {
  return ResultAsync.fromSafePromise(changes.read(slug)).andThen((found) =>
    found === null ? err(changeNotFound(slug)) : ok(found),
  );
}
