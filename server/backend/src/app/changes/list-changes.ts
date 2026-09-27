import type { ChangeWithEntries } from '#backend/app/changes/model/change-entry';
import type { Handler } from '#backend/app/handler';
import type { ChangesReader } from './changes.repository';

export type ListChangesHandler = Handler<void, ChangeWithEntries[]>;

export function listChangesHandler(changes: ChangesReader): ListChangesHandler {
  return {
    /**
     * By id descending. The id starts with the creation date, so the newest day
     * comes first; changes of one day follow each other by name, not by time.
     */
    async handle() {
      const listed = await changes.list();
      return listed.toReversed().map((change) => ({
        ...change.summary(),
        entries: change.entries(),
      }));
    },
  };
}
