import { type Context, Hono } from 'hono';
import { createChangesApp } from '#backend/adapters/in/ui/changes/changes.routes';
import { createDesignDocsApp } from '#backend/adapters/in/ui/design-docs/design-docs.routes';
import { createSearchApp } from '#backend/adapters/in/ui/search/search.routes';
import { createSourceDocumentsApp } from '#backend/adapters/in/ui/source-documents/source-documents.routes';
import { ConcurrentModificationError } from '#backend/app/changes/concurrent-modification-error';
import type { CreateChangeHandler } from '#backend/app/changes/create-change';
import type { FindChangeHandler } from '#backend/app/changes/find-change';
import type { FindDesignDocHandler } from '#backend/app/changes/find-design-doc';
import type { FindSourceDocumentHandler } from '#backend/app/changes/find-source-document';
import type { ListChangesHandler } from '#backend/app/changes/list-changes';
import { NotFoundError } from '#backend/app/changes/model/not-found-error';
import type { SearchHandler } from '#backend/app/search/search';
import { serverLogger } from '#backend/platform/logging/server-logger';

const log = serverLogger('ui');

export interface UiDeps {
  search: SearchHandler;
  createChange: CreateChangeHandler;
  listChanges: ListChangesHandler;
  findChange: FindChangeHandler;
  findDesignDoc: FindDesignDocHandler;
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

/**
 * Every route of the surface fails through here, so none of them catches: a
 * missing or malformed entity answers 404 and a write that lost a race 409, each with the
 * code the page has a sentence for, and anything unforeseen is logged and
 * answers 500.
 */
function answerError(error: Error, c: Context) {
  if (error instanceof NotFoundError) {
    const code = error.entity === 'change' ? 'change_not_found' : 'not_found';
    return c.json({ error: code }, 404);
  }
  if (error instanceof ConcurrentModificationError) {
    return c.json({ error: 'conflict' }, 409);
  }
  log.error('{method} {path} failed unexpectedly: {error}', {
    method: c.req.method,
    path: c.req.path,
    error: String(error),
    stack: error.stack,
  });
  return c.json({ error: 'internal' }, 500);
}
