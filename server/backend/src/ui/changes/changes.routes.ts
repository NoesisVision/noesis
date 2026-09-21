import { flattenErrors, sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import {
  ChangeNotFoundError,
  type ChangesService,
  DuplicateChangeError,
} from '#backend/app/changes/changes.service';
import { CreateChangeSchema } from '#backend/app/changes/model/change';

export interface ChangesDeps {
  changesService: ChangesService;
}

export function createChangesApp(deps: ChangesDeps) {
  const { changesService } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/', async (c) => {
      return c.json({ changes: await changesService.list() });
    })

    .post(
      '/',
      sValidator('json', CreateChangeSchema, (result, c) => {
        if (!result.success) {
          return c.json(
            { error: 'invalid_body', issues: flattenErrors(result.error) },
            400,
          );
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

    .get('/navigation', async (c) => {
      return c.json({ changes: await changesService.listNavigation() });
    })

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
