import { Hono } from 'hono';
import { routeParams } from '#backend/adapters/in/ui/route-params';
import {
  FindSourceDocument,
  type FindSourceDocumentHandler,
} from '#backend/app/changes/find-source-document';

export interface SourceDocumentsDeps {
  findSourceDocument: FindSourceDocumentHandler;
}

/**
 * Mounted at `/ui/changes/:change/source-documents`, read only: source documents get
 * in and change through the MCP tools, so the browser surface never writes
 * one. The change lists them.
 */
export function createSourceDocumentsApp(deps: SourceDocumentsDeps) {
  const { findSourceDocument } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono().get(
    '/:id',
    routeParams(FindSourceDocument.shape),
    async (c) => {
      return c.json({
        sourceDocument: await findSourceDocument.handle(c.req.valid('param')),
      });
    },
  );
}
