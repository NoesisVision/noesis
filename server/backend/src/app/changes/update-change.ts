import type { z } from 'zod';
import {
  ChangeSnapshot,
  type ChangeSummary,
} from '#backend/app/changes/model/change-snapshot';
import type { Handler } from '#backend/app/handler';
import { type ChangesRepository, getChangeOrThrow } from './changes.repository';

/** A new version of what a change says of itself: the working file, at the id it names. */
export const UpdateChangeCommand = ChangeSnapshot.pick({
  id: true,
  name: true,
  key: true,
  type: true,
  status: true,
  description: true,
});
export type UpdateChangeCommand = z.infer<typeof UpdateChangeCommand>;

export class UpdateChangeHandler implements Handler<
  UpdateChangeCommand,
  ChangeSummary
> {
  private readonly changes: ChangesRepository;

  constructor(changes: ChangesRepository) {
    this.changes = changes;
  }

  /** Replaces the change at `id`, what it owns aside; never creates one. */
  async handle(command: UpdateChangeCommand): Promise<ChangeSummary> {
    const { id, ...fields } = command;
    const change = await getChangeOrThrow(this.changes, id);
    change.update(fields);
    await this.changes.save(change);
    return change.summary();
  }
}
