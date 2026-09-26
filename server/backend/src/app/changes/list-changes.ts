import type { Handler } from '#backend/app/handler';
import type { ChangeWithEntries } from './change-entry';
import type { ChangesReader } from './changes.repository';

export class ListChangesHandler implements Handler<void, ChangeWithEntries[]> {
  private readonly changes: ChangesReader;

  constructor(changes: ChangesReader) {
    this.changes = changes;
  }

  /** Newest first: the id starts with the creation date. */
  async handle(): Promise<ChangeWithEntries[]> {
    const changes = (await this.changes.list()).toReversed();
    return changes.map((change) => ({
      ...change.summary(),
      entries: change.entries(),
    }));
  }
}
