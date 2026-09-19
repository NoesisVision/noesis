import { honoLogger } from '@logtape/hono';
import { Hono } from 'hono';
import type { ChangesService } from './app/changes/changes.service';
import type { DesignDocsService } from './app/design-docs/design-docs.service';
import type { SearchService } from './app/search/search.service';
import { createInternalApp } from './ui/internal.routes';
import { createUiApp } from './ui/ui.routes';

// No surface is guarded: the server runs on the developer's own machine
// (decision D1).
export interface AppDeps {
  searchService: SearchService;
  changesService: ChangesService;
  designDocsService: DesignDocsService;
}

// Keep the .route() chain unbroken: Hono infers the route tree from this
// expression for the typed RPC client (`hc`).
export function createApp(deps: AppDeps) {
  return (
    new Hono()
      // `context: true` gives every log line in the request its request id
      // (decision D10).
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
        }),
      )
      .route('/internal', createInternalApp())
  );
}
