import { Hono } from 'hono';
import type { DesignDoc } from '#backend/app/changes/design-doc';
import { FindDesignDoc } from '#backend/app/changes/find-design-doc';
import type { Handler } from '#backend/app/handler';
import { routeParams } from '../route-params';

export interface DesignDocsDeps {
  findDesignDoc: Handler<FindDesignDoc, DesignDoc>;
}

/**
 * Mounted at `/ui/changes/:change/design-docs`, read only: design documents
 * are written by the agent through the MCP tools, so the browser surface never
 * changes one. The change lists them.
 */
export function createDesignDocsApp(deps: DesignDocsDeps) {
  const { findDesignDoc } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono().get('/:id', routeParams(FindDesignDoc.shape), async (c) => {
    return c.json({
      document: await findDesignDoc.handle(c.req.valid('param')),
    });
  });
}
