import { Hono } from 'hono';
import { jsonBody } from '#backend/adapters/in/ui/json-body';
import { routeParams } from '#backend/adapters/in/ui/route-params';
import type { CreateChangeHandler } from '#backend/app/changes/create-change';
import {
  FindChange,
  type FindChangeHandler,
} from '#backend/app/changes/find-change';
import type { ListChangesHandler } from '#backend/app/changes/list-changes';
import { CreateChange } from '#backend/app/changes/model/change-snapshot';

export interface ChangesDeps {
  createChange: CreateChangeHandler;
  listChanges: ListChangesHandler;
  findChange: FindChangeHandler;
}

/**
 * Mounted at `/ui/changes`. A change is created here or by the agent through
 * the MCP tools; what it owns is written only by the agent.
 */
export function createChangesApp(deps: ChangesDeps) {
  const { createChange, listChanges, findChange } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/', async (c) => {
      return c.json({ changes: await listChanges.handle() });
    })

    .post('/', jsonBody(CreateChange), async (c) => {
      const change = await createChange.handle(c.req.valid('json'));
      return c.json({ change }, 201);
    })

    .get('/:id', routeParams(FindChange.shape), async (c) => {
      return c.json({ change: await findChange.handle(c.req.valid('param')) });
    });
}
