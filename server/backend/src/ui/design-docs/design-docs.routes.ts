import { Hono } from 'hono';
import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import { DesignDocument } from '#backend/app/design-docs/design-doc';
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
        const detail = await designDocsService.findById(change, id);
        // Encoded, so the client's type says what the JSON holds: element
        // ids as strings, not the value objects the service decodes them to.
        // The document travels whole and nothing else: the tree a reader
        // navigates it by is the same document rebuilt, which the page does
        // for itself.
        return c.json({
          summary: detail.summary,
          document: z.encode(DesignDocument, detail.document),
        });
      },
    );
}
