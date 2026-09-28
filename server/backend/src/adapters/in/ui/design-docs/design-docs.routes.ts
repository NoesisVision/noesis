import { Hono } from 'hono';
import { ChangeId } from '#backend/app/changes/change-id';
import { DesignDocumentContent } from '#backend/app/design-docs/design-doc';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import type { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import { jsonBody, workingFileLimit } from '../json-body';
import { routeParams } from '../route-params';

export interface DesignDocsDeps {
  designDocsService: DesignDocsService;
}

/**
 * Mounted at `/ui/changes/:change/design-docs`. The agent creates design
 * documents through the MCP tools; the page revises one, as a human, so it
 * may write fields in its own name.
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
    )

    .put(
      '/:id',
      workingFileLimit,
      routeParams({ change: ChangeId, id: DesignDocId }),
      jsonBody(DesignDocumentContent),
      async (c) => {
        const { change, id } = c.req.valid('param');
        const designDoc = await designDocsService.update(
          change,
          id,
          c.req.valid('json'),
          'human',
        );
        return c.json({ designDoc });
      },
    );
}
