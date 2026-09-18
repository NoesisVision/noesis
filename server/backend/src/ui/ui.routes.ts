import { Hono } from 'hono';
import type { ChangesService } from '../app/changes/changes.service.js';
import type { DesignDocsService } from '../app/design-docs/design-docs.service.js';
import type { SearchService } from '../app/search/search.service.js';
import { createChangesApp } from './changes/changes.routes.js';
import { createDesignDocsApp } from './design-docs/design-docs.routes.js';
import { createSearchApp } from './search/search.routes.js';

// The module's dependency contract — the explicit allow-list of what these
// routes may touch. Nothing outside this interface is in scope for the handlers.
export interface UiDeps {
  searchService: SearchService;
  changesService: ChangesService;
  designDocsService: DesignDocsService;
}

// Endpoints under the `ui` prefix (mounted in app.ts). The route tree stays
// inferable so the frontend can reach them through Hono's typed RPC client
// without shared path constants. The server serves the
// one checkout it was started in, so nothing is scoped by project or account
// (decision D1); imports and design docs are scoped to a change, mirroring
// `.noesis/graph/changes/<change>/` (decision D2).
export function createUiApp(deps: UiDeps) {
  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .route('/search', createSearchApp({ searchService: deps.searchService }))
    .route(
      '/changes',
      createChangesApp({ changesService: deps.changesService }),
    )
    .route(
      '/changes/:change/design-docs',
      createDesignDocsApp({ designDocsService: deps.designDocsService }),
    );
}
