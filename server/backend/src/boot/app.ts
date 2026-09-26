import { honoLogger } from '@logtape/hono';
import { Hono } from 'hono';
import { createInternalApp } from '#backend/adapters/in/ui/internal.routes';
import { createUiApp } from '#backend/adapters/in/ui/ui.routes';
import type { ChangesService } from '#backend/app/changes/changes.service';
import type { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import type { DocumentsService } from '#backend/app/information-sources/documents.service';
import type { SearchService } from '#backend/app/search/search.service';

// No surface is guarded: the server runs on the developer's own machine.
export interface AppDeps {
  searchService: SearchService;
  changesService: ChangesService;
  designDocsService: DesignDocsService;
  documentsService: DocumentsService;
}

// Keep the .route() chain unbroken: Hono infers the route tree from this
// expression for the typed RPC client (`hc`).
export function createApp(deps: AppDeps) {
  return (
    new Hono()
      // `context: true` gives every log line in the request its request id.
      .use(
        honoLogger({
          category: ['noesis', 'server', 'http'],
          format: 'structured-common',
          context: true,
          skip: (c) => c.req.path === '/internal/health',
        }),
      )
      .route(
        '/ui',
        createUiApp({
          searchService: deps.searchService,
          changesService: deps.changesService,
          designDocsService: deps.designDocsService,
          documentsService: deps.documentsService,
        }),
      )
      .route('/internal', createInternalApp())
  );
}
