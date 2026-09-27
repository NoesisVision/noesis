import { Hono } from 'hono';
import { createChangesApp } from '#backend/adapters/in/ui/changes/changes.routes';
import { createDesignDocsApp } from '#backend/adapters/in/ui/design-docs/design-docs.routes';
import { answerError } from '#backend/adapters/in/ui/error-body';
import { createSearchApp } from '#backend/adapters/in/ui/search/search.routes';
import { createSourceDocumentsApp } from '#backend/adapters/in/ui/source-documents/source-documents.routes';
import type { AddDesignDocToChangeHandler } from '#backend/app/changes/add-design-doc-to-change';
import type { AddSourceDocumentToChangeHandler } from '#backend/app/changes/add-source-document-to-change';
import type { CreateChangeHandler } from '#backend/app/changes/create-change';
import type { FindChangeHandler } from '#backend/app/changes/find-change';
import type { FindDesignDocHandler } from '#backend/app/changes/find-design-doc';
import type { FindSourceDocumentHandler } from '#backend/app/changes/find-source-document';
import type { ListChangesHandler } from '#backend/app/changes/list-changes';
import type { UpdateChangeHandler } from '#backend/app/changes/update-change';
import type { UpdateDesignDocInChangeHandler } from '#backend/app/changes/update-design-doc-in-change';
import type { UpdateSourceDocumentInChangeHandler } from '#backend/app/changes/update-source-document-in-change';
import type { SearchHandler } from '#backend/app/search/search';

export interface UiDeps {
  search: SearchHandler;
  createChange: CreateChangeHandler;
  updateChange: UpdateChangeHandler;
  listChanges: ListChangesHandler;
  findChange: FindChangeHandler;
  addDesignDocToChange: AddDesignDocToChangeHandler;
  updateDesignDocInChange: UpdateDesignDocInChangeHandler;
  findDesignDoc: FindDesignDocHandler;
  addSourceDocumentToChange: AddSourceDocumentToChangeHandler;
  updateSourceDocumentInChange: UpdateSourceDocumentInChangeHandler;
  findSourceDocument: FindSourceDocumentHandler;
}

export function createUiApp(deps: UiDeps) {
  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .onError(answerError)
    .route('/search', createSearchApp(deps))
    .route('/changes', createChangesApp(deps))
    .route('/changes/:change/design-docs', createDesignDocsApp(deps))
    .route('/changes/:change/source-documents', createSourceDocumentsApp(deps));
}
