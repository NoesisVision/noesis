import { Hono } from 'hono';
import { ChangeId } from '#backend/app/changes/change-id';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import type { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import { routeParams } from '../route-params';

export interface DesignDocsDeps {
  designDocsService: DesignDocsService;
}

/**
 * Mounted at `/ui/changes/:change/design-docs`, read only: design documents
 * are written and removed by the agent through the MCP tools, so the browser
 * surface never changes one.
 */
export function createDesignDocsApp(deps: DesignDocsDeps) {
  const { designDocsService } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/', routeParams({ change: ChangeId }), async (c) => {
      const { change } = c.req.valid('param');
      return c.json({ designDocs: await designDocsService.list(change) });
    })

    .get(
      '/:id',
      routeParams({ change: ChangeId, id: DesignDocId }),
      async (c) => {
        const { change, id } = c.req.valid('param');
        return c.json({
          document: await designDocsService.findById(change, id),
        });
      },
    );
}
