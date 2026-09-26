import { Hono } from 'hono';
import {
  FindSourceDocumentById,
  type FindSourceDocumentByIdHandler,
} from '#backend/app/information-sources/find-source-document-by-id';
import {
  ListSourceDocumentsForChange,
  type ListSourceDocumentsForChangeHandler,
} from '#backend/app/information-sources/list-source-documents-for-change';
import { routeParams } from '../route-params';

export interface DocumentsDeps {
  listSourceDocumentsForChange: ListSourceDocumentsForChangeHandler;
  findSourceDocumentById: FindSourceDocumentByIdHandler;
}

/**
 * Mounted at `/ui/changes/:change/documents`, read only: documents get in
 * and change through the MCP tools, so the browser surface never writes one.
 */
export function createDocumentsApp(deps: DocumentsDeps) {
  const { listSourceDocumentsForChange, findSourceDocumentById } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/', routeParams(ListSourceDocumentsForChange.shape), async (c) => {
      return c.json({
        documents: await listSourceDocumentsForChange.execute(
          c.req.valid('param'),
        ),
      });
    })

    .get('/:id', routeParams(FindSourceDocumentById.shape), async (c) => {
      return c.json({
        document: await findSourceDocumentById.execute(c.req.valid('param')),
      });
    });
}
