import { Hono } from 'hono';
import { jsonBody, workingFileLimit } from '#backend/adapters/in/ui/json-body';
import { routeParams } from '#backend/adapters/in/ui/route-params';
import {
  AddDesignDocToChange,
  type AddDesignDocToChangeHandler,
} from '#backend/app/changes/add-design-doc-to-change';
import {
  FindDesignDoc,
  type FindDesignDocHandler,
} from '#backend/app/changes/find-design-doc';
import {
  UpdateDesignDocInChange,
  type UpdateDesignDocInChangeHandler,
} from '#backend/app/changes/update-design-doc-in-change';

export interface DesignDocsDeps {
  addDesignDocToChange: AddDesignDocToChangeHandler;
  updateDesignDocInChange: UpdateDesignDocInChangeHandler;
  findDesignDoc: FindDesignDocHandler;
}

/**
 * Mounted at `/ui/changes/:change/design-docs`. The bodies are the working
 * files the MCP tools read; the change lists what it holds.
 */
export function createDesignDocsApp(deps: DesignDocsDeps) {
  const { addDesignDocToChange, updateDesignDocInChange, findDesignDoc } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .post(
      '/',
      workingFileLimit,
      routeParams(AddDesignDocToChange.pick({ change: true }).shape),
      jsonBody(AddDesignDocToChange.shape.designDoc),
      async (c) => {
        const designDoc = await addDesignDocToChange.handle({
          ...c.req.valid('param'),
          designDoc: c.req.valid('json'),
        });
        return c.json({ designDoc }, 201);
      },
    )

    .get('/:id', routeParams(FindDesignDoc.shape), async (c) => {
      return c.json({
        designDoc: await findDesignDoc.handle(c.req.valid('param')),
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
        });
        return c.json({ designDoc });
      },
    );
}
