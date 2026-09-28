import type { Handler } from '#backend/app/handler';
import type { Change } from './change';
import type { ChangesReader } from './changes.repository';

export type ListChangesHandler = Handler<void, Change[]>;

export function listChangesHandler(changes: ChangesReader): ListChangesHandler {
  return {
    /** Newest first: the id starts with the creation date. */
    async handle() {
      return (await changes.list()).toReversed();
    },
  };
}
