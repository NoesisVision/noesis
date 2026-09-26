import { Hono } from 'hono';
import type { Handler } from '#backend/app/handler';
import { FindSourceDocumentById } from '#backend/app/information-sources/find-source-document-by-id';
import { ListSourceDocumentsForChange } from '#backend/app/information-sources/list-source-documents-for-change';
import type { SourceDocument } from '#backend/app/information-sources/source-document';
import type { SourceDocumentSummary } from '#backend/app/information-sources/source-document-summary';
import { routeParams } from '../route-params';

export interface DocumentsDeps {
  listSourceDocumentsForChange: Handler<
    ListSourceDocumentsForChange,
    SourceDocumentSummary[]
  >;
  findSourceDocumentById: Handler<FindSourceDocumentById, SourceDocument>;
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
        documents: await listSourceDocumentsForChange.handle(
          c.req.valid('param'),
        ),
      });
    })

    .get('/:id', routeParams(FindSourceDocumentById.shape), async (c) => {
      return c.json({
        document: await findSourceDocumentById.handle(c.req.valid('param')),
      });
    });
}
