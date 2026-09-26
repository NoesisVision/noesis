import { Hono } from 'hono';
import { ChangeId } from '#backend/app/changes/change-id';
import { SourceDocumentId } from '#backend/app/information-sources/source-document-id';
import type { SourceDocumentsService } from '#backend/app/information-sources/source-documents.service';
import { routeParams } from '../route-params';

export interface DocumentsDeps {
  documentsService: SourceDocumentsService;
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
      routeParams({ change: ChangeId, id: SourceDocumentId }),
      async (c) => {
        const { change, id } = c.req.valid('param');
        return c.json({
          document: await documentsService.findById(change, id),
        });
      },
    );
}
