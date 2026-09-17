import { zValidator } from '@hono/zod-validator';
import { CreateChangeSchema } from '@repo/shared-contracts';
import { Hono } from 'hono';
import { z } from 'zod';
import { ChangeSlug } from '../../changes/change-slug.js';
import {
  ChangeNotFoundError,
  type ChangesService,
  DuplicateChangeError,
} from '../../changes/changes.service.js';

export interface ChangesDeps {
  changesService: ChangesService;
}

/**
 * Mounted at `/ui/changes`. A change is an object of the `changes`
 * collection under `.noesis/graph/`: the list reads them newest first, a
 * create derives the slug from the name and writes the object, and a slug or
 * key that already exists is a 409 naming the field.
 */
export function createChangesApp(deps: ChangesDeps) {
  const { changesService } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/', async (c) => {
      return c.json({ changes: await changesService.list() });
    })

    .post(
      '/',
      zValidator('json', CreateChangeSchema, (result, c) => {
        if (!result.success) {
          return c.json({ error: z.prettifyError(result.error) }, 400);
        }
      }),
      async (c) => {
        const data = c.req.valid('json');
        try {
          const change = await changesService.create(data);
          return c.json({ change }, 201);
        } catch (error) {
          if (error instanceof DuplicateChangeError) {
            return c.json(
              { error: 'duplicate_change', field: error.field },
              409,
            );
          }
          throw error;
        }
      },
    )

    .get('/:id', async (c) => {
      const slug = ChangeSlug.tryParse(c.req.param('id'));
      if (slug === null) return c.json({ error: 'change_not_found' }, 404);
      try {
        return c.json({ change: await changesService.findById(slug) });
      } catch (error) {
        if (error instanceof ChangeNotFoundError) {
          return c.json({ error: 'change_not_found' }, 404);
        }
        throw error;
      }
    });
}
