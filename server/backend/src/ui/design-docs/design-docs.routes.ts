import { zValidator } from '@hono/zod-validator';
import { type Context, Hono } from 'hono';
import { z } from 'zod';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import { ChangeNotFoundError } from '#backend/app/changes/changes.service';
import type { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import { designDocumentContract } from '#backend/app/validation/contracts/design-document';
import { validate } from '#backend/app/validation/validator';

export interface DesignDocsDeps {
  designDocsService: DesignDocsService;
}

const createDesignDocSchema = z.object({
  // The envelope only; the document itself runs the design-document contract
  // (schema parse + integrity check) in the handler.
  document: z.record(z.string(), z.unknown()),
});

/**
 * Mounted at `/ui/changes/:change/design-docs` — the documents of one change.
 * Reads serve the documents page; the writes are the whole-document boundary
 * of decision D4 — the route runs the design-document contract, and a
 * rejected document is a 400 naming its issues, never a stored one. A slug no
 * change has is a 404 on every route.
 */
export function createDesignDocsApp(deps: DesignDocsDeps) {
  const { designDocsService } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return (
    new Hono()
      .get('/', async (c) => {
        return inChange(c, async (change) =>
          c.json({ designDocs: await designDocsService.list(change) }),
        );
      })

      .post(
        '/',
        zValidator('json', createDesignDocSchema, (result, c) => {
          if (!result.success) {
            return c.json({ error: z.prettifyError(result.error) }, 400);
          }
        }),
        async (c) => {
          const report = validate(
            designDocumentContract,
            c.req.valid('json').document,
          );
          if (!report.ok) {
            return c.json(
              { error: 'invalid_document', issues: report.issues },
              400,
            );
          }
          return inChange(c, async (change) => {
            const designDoc = await designDocsService.create(
              change,
              report.value,
            );
            return c.json({ designDoc }, 201);
          });
        },
      )

      // The demo seed: phase 2 has no editor and no agent, so this is how a
      // reviewable document gets in at all.
      .post('/sample', async (c) => {
        return inChange(c, async (change) =>
          c.json(
            { designDoc: await designDocsService.createSample(change) },
            201,
          ),
        );
      })

      .get('/:id', async (c) => {
        return inChange(c, async (change) => {
          const detail = await designDocsService.findById(
            change,
            c.req.param('id'),
          );
          if (detail === null) return c.json({ error: 'not_found' }, 404);
          return c.json(detail);
        });
      })

      .delete('/:id', async (c) => {
        return inChange(c, async (change) => {
          const deleted = await designDocsService.delete(
            change,
            c.req.param('id'),
          );
          if (!deleted) return c.json({ error: 'not_found' }, 404);
          return c.body(null, 204);
        });
      })
  );
}

/** Runs the handler for the change in the path; a missing change is a 404. */
async function inChange<T extends Response>(
  c: Context,
  handler: (slug: ChangeSlug) => Promise<T>,
) {
  const slug = ChangeSlug.tryParse(c.req.param('change') ?? '');
  if (slug === null) return c.json({ error: 'change_not_found' }, 404);
  try {
    return await handler(slug);
  } catch (error) {
    if (error instanceof ChangeNotFoundError) {
      return c.json({ error: 'change_not_found' }, 404);
    }
    throw error;
  }
}
