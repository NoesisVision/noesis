import { Change } from '#backend/app/changes/model/change';
import { ChangeId } from '#backend/app/changes/model/change-id';
import type {
  ChangeSummary,
  CreateChange,
} from '#backend/app/changes/model/change-snapshot';
import type { Handler } from '#backend/app/handler';
import { freeSlugId } from '#backend/app/slug-id';
import type { Today } from '#backend/app/today';
import type { ChangesRepository } from './changes.repository';

export type CreateChangeHandler = Handler<CreateChange, ChangeSummary>;

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
      const id = await freeSlugId(
        ChangeId,
        command.name,
        today(),
        async (candidate) => (await changes.get(candidate)) !== null,
      );
      const created = Change.create(id, command);
      await changes.save(created);
      return created.summary();
    },
  };
}
