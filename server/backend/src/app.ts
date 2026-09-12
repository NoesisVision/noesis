import { Hono } from 'hono';
import type { ChangesService } from './changes/changes.service.js';
import type { DesignDocsService } from './design-docs/design-docs.service.js';
import { createInternalApp } from './internal/internal.routes.js';
import type { SearchService } from './ui/search/search.service.js';
import { createUiApp } from './ui/ui.routes.js';

// The composition surface: routes are segregated by consumer, one sub-app per
// surface: /ui (ui app), /internal (health and other technical endpoints).
// The agent does not come through HTTP at all — it reaches the same services
// over MCP on stdio (src/mcp, decision 68). No surface is guarded — the server
// runs on the developer's own machine inside one checkout (decision 65).
// Deps are wired by the composition root (main.ts for prod, tests otherwise);
// each surface factory receives only the slice it is allowed to touch.
export interface AppDeps {
  searchService: SearchService;
  changesService: ChangesService;
  designDocsService: DesignDocsService;
}

// No global prefix — each surface carries its own. Keep the .route() chain
// unbroken: Hono infers the route tree from this expression, which is what a
// typed RPC client (`hc`) in the frontend would consume.
export function createApp(deps: AppDeps) {
  return new Hono()
    .route(
      '/ui',
      createUiApp({
        searchService: deps.searchService,
        changesService: deps.changesService,
        designDocsService: deps.designDocsService,
      }),
    )
    .route('/internal', createInternalApp());
}
