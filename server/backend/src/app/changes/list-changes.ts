import type { ChangeWithEntries } from '#backend/app/changes/model/change-entry';
import type { Handler } from '#backend/app/handler';
import type { ChangesReader } from './changes.repository';

export class ListChangesHandler implements Handler<void, ChangeWithEntries[]> {
  private readonly changes: ChangesReader;

  constructor(changes: ChangesReader) {
    this.changes = changes;
  }

  /**
   * By id descending. The id starts with the creation date, so the newest day
   * comes first; changes of one day follow each other by name, not by time.
   */
  async handle(): Promise<ChangeWithEntries[]> {
    const changes = (await this.changes.list()).toReversed();
    return changes.map((change) => ({
      ...change.summary(),
      entries: change.entries(),
    }));
  }
}
