import { Hono } from 'hono';
import { NewChangeSchema } from '#backend/app/changes/change';
import { ChangeId } from '#backend/app/changes/change-id';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { jsonBody, workingFileLimit } from '../json-body';
import { routeParams } from '../route-params';

export interface ChangesDeps {
  changesService: ChangesService;
}

/**
 * Mounted at `/ui/changes`. The page creates a change from the same file an
 * agent hands `create_change`; the server mints its id.
 */
export function createChangesApp(deps: ChangesDeps) {
  const { changesService } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/', async (c) => {
      return c.json({ changes: await changesService.list() });
    })

    .post('/', workingFileLimit, jsonBody(NewChangeSchema), async (c) => {
      const change = await changesService.create(c.req.valid('json'));
      return c.json({ change }, 201);
    })

    .get('/navigation', async (c) => {
      return c.json({ changes: await changesService.listWithEntries() });
    })

    .get('/:id', routeParams({ id: ChangeId }), async (c) => {
      const { id } = c.req.valid('param');
      return c.json({ change: await changesService.findById(id) });
    });
}
