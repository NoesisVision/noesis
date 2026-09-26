import { Hono } from 'hono';
import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import { DocumentSchema } from '#backend/app/information-sources/document';
import { DocumentId } from '#backend/app/information-sources/document-id';
import type { DocumentsService } from '#backend/app/information-sources/documents.service';
import { routeParams } from '../route-params';

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
    .get('/', routeParams({ change: ChangeId }), async (c) => {
      const { change } = c.req.valid('param');
      return c.json({ documents: await documentsService.list(change) });
    })

    .get(
      '/:id',
      routeParams({ change: ChangeId, id: DocumentId }),
      async (c) => {
        const { change, id } = c.req.valid('param');
        const document = await documentsService.findById(change, id);
        // Encoded, so the client's type says what the JSON holds: the id as a
        // plain string, not the branded one the service holds.
        return c.json({ document: z.encode(DocumentSchema, document) });
      },
    );
}
