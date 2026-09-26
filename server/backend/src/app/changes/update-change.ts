import type { z } from 'zod';
import {
  ChangeSnapshot,
  type ChangeSummary,
} from '#backend/app/changes/model/change-snapshot';
import type { Handler } from '#backend/app/handler';
import { type ChangesRepository, getChangeOrThrow } from './changes.repository';

/** A new version of what a change says of itself: the working file, at the id it names. */
const UpdateChangeCommand = ChangeSnapshot.pick({
  id: true,
  name: true,
  key: true,
  type: true,
  status: true,
  description: true,
});
type UpdateChangeCommand = z.infer<typeof UpdateChangeCommand>;

export type UpdateChangeHandler = Handler<UpdateChangeCommand, ChangeSummary>;

export function updateChangeHandler(
  changes: ChangesRepository,
): UpdateChangeHandler {
  return {
    /** Replaces the change at `id`, what it owns aside; never creates one. */
    async handle(command) {
      const { id, ...fields } = command;
      const change = await getChangeOrThrow(changes, id);
      change.update(fields);
      await changes.save(change);
      return change.summary();
    },
  };
}
