import { Hono } from 'hono';
import { jsonBody, workingFileLimit } from '#backend/adapters/in/ui/json-body';
import { routeParams } from '#backend/adapters/in/ui/route-params';
import type { CreateChangeHandler } from '#backend/app/changes/create-change';
import {
  FindChange,
  type FindChangeHandler,
} from '#backend/app/changes/find-change';
import type { ListChangesHandler } from '#backend/app/changes/list-changes';
import {
  CreateChange,
  UpdateChange,
} from '#backend/app/changes/model/change-snapshot';
import type { UpdateChangeHandler } from '#backend/app/changes/update-change';

export interface ChangesDeps {
  createChange: CreateChangeHandler;
  updateChange: UpdateChangeHandler;
  listChanges: ListChangesHandler;
  findChange: FindChangeHandler;
}

/**
 * Mounted at `/ui/changes`. The bodies are the working files the MCP tools
 * read, so the agent's session writes through here too.
 */
export function createChangesApp(deps: ChangesDeps) {
  const { createChange, updateChange, listChanges, findChange } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/', async (c) => {
      return c.json({ changes: await listChanges.handle() });
    })

    .post('/', workingFileLimit, jsonBody(CreateChange), async (c) => {
      const change = await createChange.handle(c.req.valid('json'));
      return c.json({ change }, 201);
    })

    .get('/:id', routeParams(FindChange.shape), async (c) => {
      return c.json({ change: await findChange.handle(c.req.valid('param')) });
    })

    .patch(
      '/:id',
      workingFileLimit,
      routeParams(FindChange.shape),
      jsonBody(UpdateChange),
      async (c) => {
        const change = await updateChange.handle({
          ...c.req.valid('param'),
          ...c.req.valid('json'),
        });
        return c.json({ change });
      },
    );
}
