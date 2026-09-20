import { zValidator } from '@hono/zod-validator';
import { type Context, Hono } from 'hono';
import { z } from 'zod';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import { ChangeNotFoundError } from '#backend/app/changes/changes.service';
import {
  DocumentNotFoundError,
  type DocumentsService,
  DuplicateDocumentError,
} from '#backend/app/information-sources/documents.service';
import { documentContract } from '#backend/app/validation/contracts/document';
import { validate } from '#backend/app/validation/validator';

export interface DocumentsDeps {
  documentsService: DocumentsService;
}

const writeDocumentSchema = z.object({
  // The document itself runs the document contract in the handler.
  document: z.record(z.string(), z.unknown()),
});

/** Mounted at `/ui/changes/:change/documents`; writes are decision D4's validation boundary. */
export function createDocumentsApp(deps: DocumentsDeps) {
  const { documentsService } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return (
    new Hono()
      .get('/', async (c) => {
        return inChange(c, async (change) =>
          c.json({ documents: await documentsService.list(change) }),
        );
      })

      .post(
        '/',
        zValidator('json', writeDocumentSchema, (result, c) => {
          if (!result.success) {
            return c.json({ error: z.prettifyError(result.error) }, 400);
          }
        }),
        async (c) => {
          const report = validate(
            documentContract,
            c.req.valid('json').document,
          );
          if (!report.ok) {
            return c.json(
              { error: 'invalid_document', issues: report.issues },
              400,
            );
          }
          return inChange(c, async (change) => {
            const document = await documentsService.create(
              change,
              report.value,
            );
            return c.json({ document }, 201);
          });
        },
      )

      .get('/:id', async (c) => {
        return inChange(c, async (change) => {
          const detail = await documentsService.findById(
            change,
            c.req.param('id'),
          );
          if (detail === null) return c.json({ error: 'not_found' }, 404);
          return c.json(detail);
        });
      })

      // A new title moves the document to a new id, which the summary carries.
      .put(
        '/:id',
        zValidator('json', writeDocumentSchema, (result, c) => {
          if (!result.success) {
            return c.json({ error: z.prettifyError(result.error) }, 400);
          }
        }),
        async (c) => {
          const report = validate(
            documentContract,
            c.req.valid('json').document,
          );
          if (!report.ok) {
            return c.json(
              { error: 'invalid_document', issues: report.issues },
              400,
            );
          }
          return inChange(c, async (change) => {
            const document = await documentsService.update(
              change,
              c.req.param('id'),
              report.value,
            );
            return c.json({ document });
          });
        },
      )

      .delete('/:id', async (c) => {
        return inChange(c, async (change) => {
          const deleted = await documentsService.delete(
            change,
            c.req.param('id'),
          );
          if (!deleted) return c.json({ error: 'not_found' }, 404);
          return c.body(null, 204);
        });
      })
  );
}

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
    if (error instanceof DocumentNotFoundError) {
      return c.json({ error: 'not_found' }, 404);
    }
    if (error instanceof DuplicateDocumentError) {
      return c.json({ error: 'duplicate_document', title: error.title }, 409);
    }
    throw error;
  }
}
