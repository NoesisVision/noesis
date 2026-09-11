import { Hono } from 'hono';
import { z } from 'zod';
import {
  CHANGE_SLUG_MAX_LENGTH,
  CHANGE_SLUG_PATTERN,
} from '../../changes/changes.repository.js';
import {
  type ChangesService,
  DuplicateChangeError,
} from '../../changes/changes.service.js';

export interface ChangesDeps {
  changesService: ChangesService;
}

export const createChangeSchema = z.object({
  slug: z.string().max(CHANGE_SLUG_MAX_LENGTH).regex(CHANGE_SLUG_PATTERN),
});

/**
 * Mounted at `/ui/changes`. A change is a directory under `.noesis/changes/`,
 * so the list is the directory listing and a create is a `mkdir`; a slug
 * that already exists is a 409.
 */
export function createChangesApp(deps: ChangesDeps) {
  const { changesService } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/', async (c) => {
      return c.json({ changes: await changesService.list() });
    })

    .post('/', async (c) => {
      const parsed = createChangeSchema.safeParse(await c.req.json());
      if (!parsed.success) {
        return c.json({ error: z.prettifyError(parsed.error) }, 400);
      }
      try {
        const change = await changesService.create(parsed.data.slug);
        return c.json({ change }, 201);
      } catch (error) {
        if (error instanceof DuplicateChangeError) {
          return c.json({ error: 'duplicate_change' }, 409);
        }
        throw error;
      }
    });
}
