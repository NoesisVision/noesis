import { Hono } from 'hono';
import type { ChangeWithEntries } from '#backend/app/changes/change-entry';
import {
  FindChange,
  type FindChangeResult,
} from '#backend/app/changes/find-change';
import type { Handler } from '#backend/app/handler';
import { routeParams } from '../route-params';

export interface ChangesDeps {
  listChanges: Handler<void, ChangeWithEntries[]>;
  findChange: Handler<FindChange, FindChangeResult>;
}

/** Mounted at `/ui/changes`, read only: a change is created by the agent through the MCP tools. */
export function createChangesApp(deps: ChangesDeps) {
  const { listChanges, findChange } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/', async (c) => {
      return c.json({ changes: await listChanges.handle() });
    })

    .get('/:id', routeParams(FindChange.shape), async (c) => {
      return c.json({ change: await findChange.handle(c.req.valid('param')) });
    });
}
