import type { Handler } from '#backend/app/handler';
import { freeSlugId } from '#backend/app/slug-id';
import type { Today } from '#backend/app/today';
import { Change } from './change';
import { ChangeId } from './change-id';
import type { ChangeSummary, CreateChange } from './change-snapshot';
import type { ChangesRepository } from './changes.repository';

export class CreateChangeHandler implements Handler<
  CreateChange,
  ChangeSummary
> {
  private readonly changes: ChangesRepository;
  private readonly today: Today;

  constructor(changes: ChangesRepository, today: Today) {
    this.changes = changes;
    this.today = today;
  }

  /**
   * Creates the change in discovery, at an id minted from today's date and
   * its name. A name already used that day gets the next free suffix.
   */
  async handle(command: CreateChange): Promise<ChangeSummary> {
    const id = await freeSlugId(
      ChangeId,
      command.name,
      this.today(),
      async (candidate) => (await this.changes.get(candidate)) !== null,
    );
    const created = Change.create(id, command);
    await this.changes.save(created);
    return created.summary();
  }
}
