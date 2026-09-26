import { Hono } from 'hono';
import { routeParams } from '#backend/adapters/in/ui/route-params';
import { FindDesignDoc } from '#backend/app/changes/find-design-doc';
import type { DesignDoc } from '#backend/app/changes/model/design-doc';
import type { Handler } from '#backend/app/handler';

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
      designDoc: await findDesignDoc.handle(c.req.valid('param')),
    });
  });
}
