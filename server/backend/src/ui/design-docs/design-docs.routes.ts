import { type Context, Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../../auth/auth.middleware.js';
import {
  DesignDocProjectNotFoundError,
  type DesignDocsService,
  InvalidDesignDocumentError,
} from '../../design-docs/design-docs.service.js';

export interface DesignDocsDeps {
  designDocsService: DesignDocsService;
}

export const createDesignDocSchema = z.object({
  projectId: z.string().min(1),
  // Validated properly by the service (schema parse + integrity check); the
  // route only asserts something document-shaped arrived.
  document: z.record(z.string(), z.unknown()),
});

export const createSampleSchema = z.object({
  projectId: z.string().min(1),
});

/**
 * Mounted at `/ui/design-docs` behind `requireSession`. Reads serve the
 * documents page; the writes are the whole-document boundary of decision 51 —
 * a rejected document is a 400 naming its issues, never a stored one.
 */
export function createDesignDocsApp(deps: DesignDocsDeps) {
  const { designDocsService } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return (
    new Hono<AuthEnv>()
      .get('/', async (c) => {
        const projectId = c.req.query('projectId');
        if (projectId === undefined || projectId === '') {
          return c.json({ error: 'missing_project_id' }, 400);
        }
        return c.json({
          designDocs: await designDocsService.listByProject(projectId),
        });
      })

      .post('/', async (c) => {
        const parsed = createDesignDocSchema.safeParse(await c.req.json());
        if (!parsed.success) {
          return c.json({ error: z.prettifyError(parsed.error) }, 400);
        }
        try {
          const designDoc = await designDocsService.create(
            parsed.data.projectId,
            parsed.data.document,
          );
          return c.json({ designDoc }, 201);
        } catch (error) {
          const refused = refusalResponse(c, error);
          if (refused !== null) return refused;
          throw error;
        }
      })

      // The demo seed: phase 2 has no editor and no agent, so this is how a
      // reviewable document gets into a project at all.
      .post('/sample', async (c) => {
        const parsed = createSampleSchema.safeParse(await c.req.json());
        if (!parsed.success) {
          return c.json({ error: z.prettifyError(parsed.error) }, 400);
        }
        try {
          const designDoc = await designDocsService.createSample(
            parsed.data.projectId,
          );
          return c.json({ designDoc }, 201);
        } catch (error) {
          const refused = refusalResponse(c, error);
          if (refused !== null) return refused;
          throw error;
        }
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

/** The two write refusals shared by create and sample. */
function refusalResponse(c: Context<AuthEnv>, error: unknown): Response | null {
  if (error instanceof InvalidDesignDocumentError) {
    return c.json({ error: 'invalid_document', issues: error.issues }, 400);
  }
  if (error instanceof DesignDocProjectNotFoundError) {
    return c.json({ error: 'project_not_found' }, 404);
  }
  return null;
}
