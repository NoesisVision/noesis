import { Hono } from 'hono';
import { z } from 'zod';
import { DocumentSchema } from '#backend/app/information-sources/document';
import { DocumentId } from '#backend/app/information-sources/document-id';
import type { DocumentsService } from '#backend/app/information-sources/documents.service';
import { inChange } from '../changes/in-change';

export interface DocumentsDeps {
  documentsService: DocumentsService;
}

/**
 * Mounted at `/ui/changes/:change/documents`, read only: documents get in
 * and change through the MCP tools, so the browser surface never writes one.
 */
export function createDocumentsApp(deps: DocumentsDeps) {
  const { documentsService } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/', async (c) => {
      return inChange(c, async (change) =>
        c.json({ documents: await documentsService.list(change) }),
      );
    })

    .get('/:id', async (c) => {
      return inChange(c, async (change) => {
        const id = DocumentId.safeParse(c.req.param('id'));
        if (!id.success) return c.json({ error: 'not_found' }, 404);
        const detail = await documentsService.findById(change, id.data);
        if (detail === null) return c.json({ error: 'not_found' }, 404);
        // Encoded, so the client's type says what the JSON holds: the id as a
        // plain string, not the branded one the service holds.
        return c.json({
          summary: detail.summary,
          document: z.encode(DocumentSchema, detail.document),
        });
      });
    });
}
