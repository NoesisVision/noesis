import { Hono } from 'hono';
import {
  FindDesignDoc,
  type FindDesignDocHandler,
} from '#backend/app/design-docs/find-design-doc';
import {
  UpdateDesignDocInChange,
  type UpdateDesignDocInChangeHandler,
} from '#backend/app/design-docs/update-design-doc-in-change';
import { jsonBody, workingFileLimit } from '../json-body';
import { routeParams } from '../route-params';

export interface DesignDocsDeps {
  findDesignDoc: FindDesignDocHandler;
  updateDesignDocInChange: UpdateDesignDocInChangeHandler;
}

/**
 * Mounted at `/ui/changes/:change/design-docs`. The agent creates design
 * documents through the MCP tools; the page revises one, as a human, so it
 * may write fields in its own name.
 */
export function createDesignDocsApp(deps: DesignDocsDeps) {
  const { findDesignDoc, updateDesignDocInChange } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/:id', routeParams(FindDesignDoc.shape), async (c) => {
      return c.json({
        document: await findDesignDoc.handle(c.req.valid('param')),
      });
    })

    .put(
      '/:id',
      workingFileLimit,
      routeParams(
        UpdateDesignDocInChange.pick({ change: true, id: true }).shape,
      ),
      jsonBody(UpdateDesignDocInChange.shape.designDoc),
      async (c) => {
        const designDoc = await updateDesignDocInChange.handle({
          ...c.req.valid('param'),
          designDoc: c.req.valid('json'),
          writer: 'human',
        });
        return c.json({ designDoc });
      },
    );
}
