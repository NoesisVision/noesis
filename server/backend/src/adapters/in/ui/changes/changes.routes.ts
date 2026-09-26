import { Hono } from 'hono';
import {
  FindChange,
  type FindChangeResult,
} from '#backend/app/changes/find-change';
import type { ChangeWithEntries } from '#backend/app/changes/model/change-entry';
import {
  type ChangeSummary,
  CreateChange,
} from '#backend/app/changes/model/change-snapshot';
import type { Handler } from '#backend/app/handler';
import { jsonBody } from '../json-body';
import { routeParams } from '../route-params';

export interface ChangesDeps {
  createChange: Handler<CreateChange, ChangeSummary>;
  listChanges: Handler<void, ChangeWithEntries[]>;
  findChange: Handler<FindChange, FindChangeResult>;
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
