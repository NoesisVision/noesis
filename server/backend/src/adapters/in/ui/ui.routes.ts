import { type Context, Hono } from 'hono';
import type {
  FindChange,
  FindChangeResult,
} from '#backend/app/changes/find-change';
import type { FindDesignDoc } from '#backend/app/changes/find-design-doc';
import type { FindSourceDocument } from '#backend/app/changes/find-source-document';
import type { ChangeWithEntries } from '#backend/app/changes/model/change-entry';
import type { DesignDoc } from '#backend/app/changes/model/design-doc';
import type { SourceDocument } from '#backend/app/changes/model/source-document';
import { ConcurrentModificationError } from '#backend/app/concurrent-modification-error';
import type { Handler } from '#backend/app/handler';
import { NotFoundError } from '#backend/app/not-found-error';
import type { SearchService } from '#backend/app/search/search.service';
import { serverLogger } from '#backend/platform/logging/server-logger';
import { createChangesApp } from './changes/changes.routes';
import { createDesignDocsApp } from './design-docs/design-docs.routes';
import { createSearchApp } from './search/search.routes';
import { createSourceDocumentsApp } from './source-documents/source-documents.routes';

const log = serverLogger('ui');

export interface UiDeps {
  searchService: SearchService;
  listChanges: Handler<void, ChangeWithEntries[]>;
  findChange: Handler<FindChange, FindChangeResult>;
  findDesignDoc: Handler<FindDesignDoc, DesignDoc>;
  findSourceDocument: Handler<FindSourceDocument, SourceDocument>;
}

export function createUiApp(deps: UiDeps) {
  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .onError(answerError)
    .route('/search', createSearchApp({ searchService: deps.searchService }))
    .route(
      '/changes',
      createChangesApp({
        listChanges: deps.listChanges,
        findChange: deps.findChange,
      }),
    )
    .route(
      '/changes/:change/design-docs',
      createDesignDocsApp({ findDesignDoc: deps.findDesignDoc }),
    )
    .route(
      '/changes/:change/source-documents',
      createSourceDocumentsApp({ findSourceDocument: deps.findSourceDocument }),
    );
}

/**
 * Every route of the surface fails through here, so none of them catches: a
 * missing entity answers 404 and a write that lost a race 409, each with the
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
