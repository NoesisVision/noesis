import { CreateChangeSchema } from '@repo/shared-contracts';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  ChangeNotFoundError,
  type ChangesService,
  DuplicateChangeError,
} from '../../changes/changes.service.js';

export interface ChangesDeps {
  changesService: ChangesService;
}

/**
 * Mounted at `/ui/changes`. A change is a directory under `.noesis/changes/`
 * with its `change.json`: the list reads them newest first, a create derives
 * the slug from the name and writes both, and a slug or key that already
 * exists is a 409 naming the field.
 */
export function createChangesApp(deps: ChangesDeps) {
  const { changesService } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/', async (c) => {
      return c.json({ changes: await changesService.list() });
    })

    .post('/', async (c) => {
      const parsed = CreateChangeSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        return c.json({ error: z.prettifyError(parsed.error) }, 400);
      }
      try {
        const change = await changesService.create(parsed.data);
        return c.json({ change }, 201);
      } catch (error) {
        if (error instanceof DuplicateChangeError) {
          return c.json({ error: 'duplicate_change', field: error.field }, 409);
        }
        throw error;
      }
    })

    .get('/:id', async (c) => {
      try {
        return c.json({
          change: await changesService.findById(c.req.param('id')),
        });
      } catch (error) {
        if (error instanceof ChangeNotFoundError) {
          return c.json({ error: 'change_not_found' }, 404);
        }
        throw error;
      }
    });
}
