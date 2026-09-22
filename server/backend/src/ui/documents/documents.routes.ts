import { Hono } from 'hono';
import { DocumentId } from '#backend/app/information-sources/document-id';
import type { DocumentsService } from '#backend/app/information-sources/documents.service';
import { inChange, notFound } from '../changes/in-change';

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
      return inChange(c, (change) =>
        documentsService.list(change).match(
          (documents) => c.json({ documents }),
          (error) => notFound(c, error),
        ),
      );
    })

    .get('/:id', async (c) => {
      return inChange(c, async (change) => {
        const id = DocumentId.tryCreate(c.req.param('id'));
        if (id.isErr()) return c.json({ error: 'not_found' }, 404);
        return documentsService.findById(change, id.value).match(
          (detail) => c.json(detail),
          (error) => notFound(c, error),
        );
      });
    });
}
