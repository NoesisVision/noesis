import { Hono } from 'hono';
import { z } from 'zod';
import {
  type DesignDocsService,
  InvalidDesignDocumentError,
} from '../../design-docs/design-docs.service.js';

export interface DesignDocsDeps {
  designDocsService: DesignDocsService;
}

export const createDesignDocSchema = z.object({
  // Validated properly by the service (schema parse + integrity check); the
  // route only asserts something document-shaped arrived.
  document: z.record(z.string(), z.unknown()),
});

/**
 * Mounted at `/ui/design-docs`. Reads serve the documents page; the writes are
 * the whole-document boundary of decision 51 — a rejected document is a 400
 * naming its issues, never a stored one.
 */
export function createDesignDocsApp(deps: DesignDocsDeps) {
  const { designDocsService } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return (
    new Hono()
      .get('/', async (c) => {
        return c.json({ designDocs: await designDocsService.list() });
      })

      .post('/', async (c) => {
        const parsed = createDesignDocSchema.safeParse(await c.req.json());
        if (!parsed.success) {
          return c.json({ error: z.prettifyError(parsed.error) }, 400);
        }
        try {
          const designDoc = await designDocsService.create(
            parsed.data.document,
          );
          return c.json({ designDoc }, 201);
        } catch (error) {
          if (error instanceof InvalidDesignDocumentError) {
            return c.json(
              { error: 'invalid_document', issues: error.issues },
              400,
            );
          }
          throw error;
        }
      })

      // The demo seed: phase 2 has no editor and no agent, so this is how a
      // reviewable document gets in at all.
      .post('/sample', async (c) => {
        return c.json(
          { designDoc: await designDocsService.createSample() },
          201,
        );
      })

      .get('/:id', async (c) => {
        const detail = await designDocsService.findById(c.req.param('id'));
        if (detail === null) return c.json({ error: 'not_found' }, 404);
        return c.json(detail);
      })

      .delete('/:id', async (c) => {
        const deleted = await designDocsService.delete(c.req.param('id'));
        if (!deleted) return c.json({ error: 'not_found' }, 404);
        return c.body(null, 204);
      })
  );
}
