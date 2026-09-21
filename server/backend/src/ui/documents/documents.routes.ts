import { flattenErrors, sValidator } from '@hono/standard-validator';
import { type Context, Hono } from 'hono';
import { z } from 'zod';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import { ChangeNotFoundError } from '#backend/app/changes/changes.service';
import { CreateDocumentSchema } from '#backend/app/information-sources/document';
import { DocumentId } from '#backend/app/information-sources/document-id';
import {
  DocumentNotFoundError,
  type DocumentsService,
  DuplicateDocumentError,
} from '#backend/app/information-sources/documents.service';

export interface DocumentsDeps {
  documentsService: DocumentsService;
}

// The document's own contract, not an opaque object, and without the id: the
// service derives that from the title. One pass in the middleware checks the
// shape, the title pattern that guarantees an id included.
const writeDocumentSchema = z.object({ document: CreateDocumentSchema });

/** Mounted at `/ui/changes/:change/documents`; writes are validated here. */
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
        sValidator('json', writeDocumentSchema, (result, c) => {
          if (!result.success) {
            return c.json(
              { error: 'invalid_body', issues: flattenErrors(result.error) },
              400,
            );
          }
        }),
        async (c) => {
          const { document: input } = c.req.valid('json');
          return inChange(c, async (change) => {
            const document = await documentsService.create(change, input);
            return c.json({ document }, 201);
          });
        },
      )

      .get('/:id', async (c) => {
        return inChange(c, async (change) => {
          const id = DocumentId.tryParse(c.req.param('id'));
          if (id === null) return c.json({ error: 'not_found' }, 404);
          const detail = await documentsService.findById(change, id);
          if (detail === null) return c.json({ error: 'not_found' }, 404);
          return c.json(detail);
        });
      })

      // A new title moves the document to a new id, which the summary carries.
      .put(
        '/:id',
        sValidator('json', writeDocumentSchema, (result, c) => {
          if (!result.success) {
            return c.json(
              { error: 'invalid_body', issues: flattenErrors(result.error) },
              400,
            );
          }
        }),
        async (c) => {
          const { document: input } = c.req.valid('json');
          return inChange(c, async (change) => {
            const id = DocumentId.tryParse(c.req.param('id'));
            if (id === null) return c.json({ error: 'not_found' }, 404);
            const document = await documentsService.update(change, id, input);
            return c.json({ document });
          });
        },
      )

      .delete('/:id', async (c) => {
        return inChange(c, async (change) => {
          const id = DocumentId.tryParse(c.req.param('id'));
          if (id === null) return c.json({ error: 'not_found' }, 404);
          const deleted = await documentsService.delete(change, id);
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
