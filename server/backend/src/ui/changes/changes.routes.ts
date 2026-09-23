import { Hono } from 'hono';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import {
  ChangeNotFoundError,
  type ChangesService,
} from '#backend/app/changes/changes.service';

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
      const slug = ChangeSlug.safeParse(c.req.param('id'));
      if (!slug.success) return c.json({ error: 'change_not_found' }, 404);
      try {
        return c.json({ change: await changesService.findById(slug.data) });
      } catch (error) {
        if (error instanceof ChangeNotFoundError) {
          return c.json({ error: 'change_not_found' }, 404);
        }
        throw error;
      }
    });
}
