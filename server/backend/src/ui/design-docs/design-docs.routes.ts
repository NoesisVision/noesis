import { Hono } from 'hono';
import { z } from 'zod';
import { DesignDocumentSchema } from '#backend/app/design-docs/design-doc';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import type { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import { inChange, notFound } from '../changes/in-change';

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
    .get('/', async (c) => {
      return inChange(c, (change) =>
        designDocsService.list(change).match(
          (designDocs) => c.json({ designDocs }),
          (error) => notFound(c, error),
        ),
      );
    })

    .get('/:id', async (c) => {
      return inChange(c, async (change) => {
        const id = DesignDocId.tryCreate(c.req.param('id'));
        if (id.isErr()) return c.json({ error: 'not_found' }, 404);
        return designDocsService.findById(change, id.value).match(
          // Encoded, so the client's type says what the JSON holds: element
          // ids as strings, not the value objects the service decodes them to.
          ({ summary, document }) =>
            c.json({
              summary,
              document: z.encode(DesignDocumentSchema, document),
            }),
          (error) => notFound(c, error),
        );
      });
    });
}
