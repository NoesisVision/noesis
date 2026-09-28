import type { Handler } from '#backend/app/handler';
import { NotFoundError } from '#backend/app/not-found-error';
import type { Change } from './change';
import type { ChangesRepository } from './changes.repository';

/** The command is the change whole, at the id it names. */
export type UpdateChangeHandler = Handler<Change, Change>;

export function updateChangeHandler(
  changes: ChangesRepository,
): UpdateChangeHandler {
  return {
    /** Replaces the change at its id, what it owns aside; never creates one. */
    async handle(command) {
      if (!(await changes.replace(command))) {
        throw new NotFoundError('change', command.id);
      }
      return command;
    },
  };
}
