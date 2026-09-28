import { Hono } from 'hono';
import { NewChangeSchema } from '#backend/app/changes/change';
import type { CreateChangeHandler } from '#backend/app/changes/create-change';
import {
  FindChange,
  type FindChangeHandler,
} from '#backend/app/changes/find-change';
import type { ListChangesHandler } from '#backend/app/changes/list-changes';
import type { ListChangesWithEntriesHandler } from '#backend/app/changes/list-changes-with-entries';
import { jsonBody, workingFileLimit } from '../json-body';
import { routeParams } from '../route-params';

export interface ChangesDeps {
  createChange: CreateChangeHandler;
  listChanges: ListChangesHandler;
  listChangesWithEntries: ListChangesWithEntriesHandler;
  findChange: FindChangeHandler;
}

/**
 * Mounted at `/ui/changes`. The page creates a change from the same file an
 * agent hands `create_change`; the server mints its id.
 */
export function createChangesApp(deps: ChangesDeps) {
  const { createChange, listChanges, listChangesWithEntries, findChange } =
    deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/', async (c) => {
      return c.json({ changes: await listChanges.handle() });
    })

    .post('/', workingFileLimit, jsonBody(NewChangeSchema), async (c) => {
      const change = await createChange.handle(c.req.valid('json'));
      return c.json({ change }, 201);
    })

    .get('/navigation', async (c) => {
      return c.json({ changes: await listChangesWithEntries.handle() });
    })

    .get('/:id', routeParams(FindChange.shape), async (c) => {
      return c.json({ change: await findChange.handle(c.req.valid('param')) });
    });
}
