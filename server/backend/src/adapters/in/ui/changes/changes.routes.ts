import { Hono } from 'hono';
import { ChangeId } from '#backend/app/changes/change-id';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { routeParams } from '../route-params';

export interface ChangesDeps {
  changesService: ChangesService;
}

/** Mounted at `/ui/changes`, read only: a change is created by the agent through the MCP tools. */
export function createChangesApp(deps: ChangesDeps) {
  const { changesService } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/', async (c) => {
      return c.json({ changes: await changesService.list() });
    })

    .get('/navigation', async (c) => {
      return c.json({ changes: await changesService.listWithEntries() });
    })

    .get('/:id', routeParams({ id: ChangeId }), async (c) => {
      const { id } = c.req.valid('param');
      return c.json({ change: await changesService.findById(id) });
    });
}
