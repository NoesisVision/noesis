import type { ChangeId } from '#backend/app/changes/model/change-id';
import type {
  ChangeSummary,
  UpdateChange,
} from '#backend/app/changes/model/change-snapshot';
import type { Handler } from '#backend/app/handler';
import { type ChangesRepository, getChangeOrThrow } from './changes.repository';

/** A new version of what a change says of itself. `change` is the working file: the id travels beside it. */
export interface UpdateChangeCommand {
  id: ChangeId;
  change: UpdateChange;
}

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
    const change = await getChangeOrThrow(this.changes, command.id);
    change.update(command.change);
    await this.changes.save(change);
    return change.summary();
  }
}
