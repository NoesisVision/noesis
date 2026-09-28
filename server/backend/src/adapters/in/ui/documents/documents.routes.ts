import { Hono } from 'hono';
import { ChangeId } from '#backend/app/changes/change-id';
import { DocumentContentSchema } from '#backend/app/information-sources/document';
import { DocumentId } from '#backend/app/information-sources/document-id';
import type { DocumentsService } from '#backend/app/information-sources/documents.service';
import { jsonBody, workingFileLimit } from '../json-body';
import { routeParams } from '../route-params';

export interface DocumentsDeps {
  documentsService: DocumentsService;
}

/**
 * Mounted at `/ui/changes/:change/documents`. The page adds a document from
 * the same file an agent hands `create_document_in_change`, and removes one.
 */
export function createDocumentsApp(deps: DocumentsDeps) {
  const { documentsService } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/', routeParams({ change: ChangeId }), async (c) => {
      const { change } = c.req.valid('param');
      return c.json({ documents: await documentsService.list(change) });
    })

    .post(
      '/',
      workingFileLimit,
      routeParams({ change: ChangeId }),
      jsonBody(DocumentContentSchema),
      async (c) => {
        const { change } = c.req.valid('param');
        const document = await documentsService.create(
          change,
          c.req.valid('json'),
        );
        return c.json({ document }, 201);
      },
    )

    .get(
      '/:id',
      routeParams({ change: ChangeId, id: DocumentId }),
      async (c) => {
        const { change, id } = c.req.valid('param');
        return c.json({
          document: await documentsService.findById(change, id),
        });
      },
    )

    .delete(
      '/:id',
      routeParams({ change: ChangeId, id: DocumentId }),
      async (c) => {
        const { change, id } = c.req.valid('param');
        await documentsService.delete(change, id);
        return c.body(null, 204);
      },
    );
}
