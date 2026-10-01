import type { Handler } from '#backend/app/handler';
import { NotFoundError } from '#backend/app/not-found-error';
import type { Change } from './change';
import type { ChangeId } from './change-id';
import { type ChangesRepository, getChangeOrThrow } from './changes.repository';

/** A change to remove, with everything it owns. */
interface DeleteChange {
  id: ChangeId;
}

/** Answers with the change as it was before it went. */
export type DeleteChangeHandler = Handler<DeleteChange, Change>;

export function deleteChangeHandler(
  changes: ChangesRepository,
): DeleteChangeHandler {
  return {
    /**
     * Removes the change with every document and design document it owns;
     * refuses an id that names no change.
     */
    async handle({ id }) {
      const change = await getChangeOrThrow(changes, id);
      if (!(await changes.delete(id))) throw new NotFoundError('change', id);
      return change;
    },
  };
}
