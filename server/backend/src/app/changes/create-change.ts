import type { Today } from '#backend/app/clock';
import type { Handler } from '#backend/app/handler';
import { createAtFreeSlugId } from '#backend/app/slug-id';
import type { Change, NewChange } from './change';
import { ChangeId } from './change-id';
import type { ChangesRepository } from './changes.repository';

export type CreateChangeHandler = Handler<NewChange, Change>;

export function createChangeHandler(
  changes: ChangesRepository,
  today: Today,
): CreateChangeHandler {
  return {
    /**
     * Creates the change in discovery, at an id minted from today's date and
     * its name. A name already used that day gets the next free suffix.
     */
    async handle(command) {
      const at = (id: ChangeId): Change => ({
        id,
        ...command,
        status: 'discovery',
      });
      const id = await createAtFreeSlugId(
        ChangeId,
        command.name,
        today(),
        (candidate) => changes.create(at(candidate)),
      );
      return at(id);
    },
  };
}
