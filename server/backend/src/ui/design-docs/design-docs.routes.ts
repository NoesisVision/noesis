import { type Context, Hono } from 'hono';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import { ChangeNotFoundError } from '#backend/app/changes/changes.service';
import type { DesignDocsService } from '#backend/app/design-docs/design-docs.service';

export interface DesignDocsDeps {
  designDocsService: DesignDocsService;
}

/**
 * Mounted at `/ui/changes/:change/design-docs`, read and delete only: design
 * documents are written by the agent through the MCP tools (decision D3), so
 * the browser surface never authors one.
 */
export function createDesignDocsApp(deps: DesignDocsDeps) {
  const { designDocsService } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/', async (c) => {
      return inChange(c, async (change) =>
        c.json({ designDocs: await designDocsService.list(change) }),
      );
    })

    .get('/:id', async (c) => {
      return inChange(c, async (change) => {
        const detail = await designDocsService.findById(
          change,
          c.req.param('id'),
        );
        if (detail === null) return c.json({ error: 'not_found' }, 404);
        return c.json(detail);
      });
    })

    .delete('/:id', async (c) => {
      return inChange(c, async (change) => {
        const deleted = await designDocsService.delete(
          change,
          c.req.param('id'),
        );
        if (!deleted) return c.json({ error: 'not_found' }, 404);
        return c.body(null, 204);
      });
    });
}

async function inChange<T extends Response>(
  c: Context,
  handler: (slug: ChangeSlug) => Promise<T>,
) {
  const slug = ChangeSlug.tryParse(c.req.param('change') ?? '');
  if (slug === null) return c.json({ error: 'change_not_found' }, 404);
  try {
    return await handler(slug);
  } catch (error) {
    if (error instanceof ChangeNotFoundError) {
      return c.json({ error: 'change_not_found' }, 404);
    }
    throw error;
  }
}
