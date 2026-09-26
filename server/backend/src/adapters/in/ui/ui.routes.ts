import { type Context, Hono } from 'hono';
import type { ChangesService } from '#backend/app/changes/changes.service';
import type { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import type { DocumentsService } from '#backend/app/information-sources/documents.service';
import { NotFoundError } from '#backend/app/not-found-error';
import type { SearchService } from '#backend/app/search/search.service';
import { serverLogger } from '#backend/platform/logging/server-logger';
import { createChangesApp } from './changes/changes.routes';
import { createDesignDocsApp } from './design-docs/design-docs.routes';
import { createDocumentsApp } from './documents/documents.routes';
import { createSearchApp } from './search/search.routes';

const log = serverLogger('ui');

export interface UiDeps {
  searchService: SearchService;
  changesService: ChangesService;
  designDocsService: DesignDocsService;
  documentsService: DocumentsService;
}

export function createUiApp(deps: UiDeps) {
  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .onError(answerError)
    .route('/search', createSearchApp({ searchService: deps.searchService }))
    .route(
      '/changes',
      createChangesApp({ changesService: deps.changesService }),
    )
    .route(
      '/changes/:change/design-docs',
      createDesignDocsApp({ designDocsService: deps.designDocsService }),
    )
    .route(
      '/changes/:change/documents',
      createDocumentsApp({ documentsService: deps.documentsService }),
    );
}

/**
 * Every route of the surface fails through here, so none of them catches: a
 * missing entity answers 404 with the code the page has a sentence for, and
 * anything unforeseen is logged and answers 500.
 */
function answerError(error: Error, c: Context) {
  if (error instanceof NotFoundError) {
    const code = error.entity === 'change' ? 'change_not_found' : 'not_found';
    return c.json({ error: code }, 404);
  }
  log.error('{method} {path} failed unexpectedly: {error}', {
    method: c.req.method,
    path: c.req.path,
    error: String(error),
    stack: error.stack,
  });
  return c.json({ error: 'internal' }, 500);
}
