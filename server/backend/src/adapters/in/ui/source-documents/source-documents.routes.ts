import { Hono } from 'hono';
import { jsonBody, workingFileLimit } from '#backend/adapters/in/ui/json-body';
import { routeParams } from '#backend/adapters/in/ui/route-params';
import {
  AddSourceDocumentToChange,
  type AddSourceDocumentToChangeHandler,
} from '#backend/app/changes/add-source-document-to-change';
import {
  FindSourceDocument,
  type FindSourceDocumentHandler,
} from '#backend/app/changes/find-source-document';
import {
  UpdateSourceDocumentInChange,
  type UpdateSourceDocumentInChangeHandler,
} from '#backend/app/changes/update-source-document-in-change';

export interface SourceDocumentsDeps {
  addSourceDocumentToChange: AddSourceDocumentToChangeHandler;
  updateSourceDocumentInChange: UpdateSourceDocumentInChangeHandler;
  findSourceDocument: FindSourceDocumentHandler;
}

/**
 * Mounted at `/ui/changes/:change/source-documents`. The bodies are the
 * working files the MCP tools read; the change lists what it holds.
 */
export function createSourceDocumentsApp(deps: SourceDocumentsDeps) {
  const {
    addSourceDocumentToChange,
    updateSourceDocumentInChange,
    findSourceDocument,
  } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .post(
      '/',
      workingFileLimit,
      routeParams(AddSourceDocumentToChange.pick({ change: true }).shape),
      jsonBody(AddSourceDocumentToChange.shape.sourceDocument),
      async (c) => {
        const sourceDocument = await addSourceDocumentToChange.handle({
          ...c.req.valid('param'),
          sourceDocument: c.req.valid('json'),
        });
        return c.json({ sourceDocument }, 201);
      },
    )

    .get('/:id', routeParams(FindSourceDocument.shape), async (c) => {
      return c.json({
        sourceDocument: await findSourceDocument.handle(c.req.valid('param')),
      });
    })

    .put(
      '/:id',
      workingFileLimit,
      routeParams(
        UpdateSourceDocumentInChange.pick({ change: true, id: true }).shape,
      ),
      jsonBody(UpdateSourceDocumentInChange.shape.sourceDocument),
      async (c) => {
        const sourceDocument = await updateSourceDocumentInChange.handle({
          ...c.req.valid('param'),
          sourceDocument: c.req.valid('json'),
        });
        return c.json({ sourceDocument });
      },
    );
}
