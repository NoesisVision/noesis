import { Hono } from 'hono';
import { z } from 'zod';
import { DesignDocumentSchema } from '#backend/app/design-docs/design-doc';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import type { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import { inChange } from '../changes/in-change';
import { outlineOf } from './design-doc-outline';

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
      return inChange(c, async (change) =>
        c.json({ designDocs: await designDocsService.list(change) }),
      );
    })

    .get('/:id', async (c) => {
      return inChange(c, async (change) => {
        const id = DesignDocId.safeParse(c.req.param('id'));
        if (!id.success) return c.json({ error: 'not_found' }, 404);
        const detail = await designDocsService.findById(change, id.data);
        if (detail === null) return c.json({ error: 'not_found' }, 404);
        // Encoded, so the client's type says what the JSON holds: element
        // ids as strings, not the value objects the service decodes them to.
        // The outline beside it is the same document as a tree; the reader
        // needs both at once, so they travel together.
        return c.json({
          summary: detail.summary,
          document: z.encode(DesignDocumentSchema, detail.document),
          outline: outlineOf(detail.document),
        });
      });
    });
}
