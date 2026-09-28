import { Hono } from 'hono';
import {
  CreateDocumentInChange,
  type CreateDocumentInChangeHandler,
} from '#backend/app/information-sources/create-document-in-change';
import {
  DeleteDocumentFromChange,
  type DeleteDocumentFromChangeHandler,
} from '#backend/app/information-sources/delete-document-from-change';
import {
  FindDocument,
  type FindDocumentHandler,
} from '#backend/app/information-sources/find-document';
import {
  ListDocumentsInChange,
  type ListDocumentsInChangeHandler,
} from '#backend/app/information-sources/list-documents-in-change';
import { jsonBody, workingFileLimit } from '../json-body';
import { routeParams } from '../route-params';

export interface DocumentsDeps {
  listDocumentsInChange: ListDocumentsInChangeHandler;
  findDocument: FindDocumentHandler;
  createDocumentInChange: CreateDocumentInChangeHandler;
  deleteDocumentFromChange: DeleteDocumentFromChangeHandler;
}

/**
 * Mounted at `/ui/changes/:change/documents`. The page adds a document from
 * the same file an agent hands `create_document_in_change`, and removes one.
 */
export function createDocumentsApp(deps: DocumentsDeps) {
  const {
    listDocumentsInChange,
    findDocument,
    createDocumentInChange,
    deleteDocumentFromChange,
  } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/', routeParams(ListDocumentsInChange.shape), async (c) => {
      return c.json({
        documents: await listDocumentsInChange.handle(c.req.valid('param')),
      });
    })

    .post(
      '/',
      workingFileLimit,
      routeParams(CreateDocumentInChange.pick({ change: true }).shape),
      jsonBody(CreateDocumentInChange.shape.document),
      async (c) => {
        const document = await createDocumentInChange.handle({
          ...c.req.valid('param'),
          document: c.req.valid('json'),
        });
        return c.json({ document }, 201);
      },
    )

    .get('/:id', routeParams(FindDocument.shape), async (c) => {
      return c.json({
        document: await findDocument.handle(c.req.valid('param')),
      });
    })

    .delete('/:id', routeParams(DeleteDocumentFromChange.shape), async (c) => {
      await deleteDocumentFromChange.handle(c.req.valid('param'));
      return c.body(null, 204);
    });
}
