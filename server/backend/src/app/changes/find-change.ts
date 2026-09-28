import { z } from 'zod';
import type { Handler } from '#backend/app/handler';
import type { Change } from './change';
import { ChangeId } from './change-id';
import { type ChangesReader, getChangeOrThrow } from './changes.repository';

/** One change, by its id. */
export const FindChange = z.object({ id: ChangeId });
export type FindChange = z.infer<typeof FindChange>;

export type FindChangeHandler = Handler<FindChange, Change>;

export function findChangeHandler(changes: ChangesReader): FindChangeHandler {
  return {
    handle: (query) => getChangeOrThrow(changes, query.id),
  };
}
