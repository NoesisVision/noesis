import { Hono } from 'hono';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { inChange, notFound } from './in-change';

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
      return c.json({ changes: await changesService.listNavigation() });
    })

    .get('/:id', async (c) => {
      return inChange(
        c,
        (slug) =>
          changesService.findById(slug).match(
            (change) => c.json({ change }),
            (error) => notFound(c, error),
          ),
        'id',
      );
    });
}
