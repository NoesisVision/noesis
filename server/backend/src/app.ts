import { apiRoutes } from '@repo/local-contracts';
import { Hono } from 'hono';
import { createApiApp } from './api/api.routes.js';
import type { GreetingService } from './greeting/greeting.service.js';
import { createInternalApp } from './internal/internal.routes.js';
import type { SearchService } from './ui/search/search.service.js';
import { createUiApp } from './ui/ui.routes.js';

// The composition surface: routes are segregated by consumer, one sub-app per
// surface, so each surface can carry its own auth later: /ui (ui app),
// /api (local app / MCP), /internal (health and other technical endpoints).
// Deps are wired by the composition root (main.ts for prod, tests otherwise);
// each surface factory receives only the slice it is allowed to touch.
export interface AppDeps {
  greetingService: GreetingService;
  searchService: SearchService;
}

// No global prefix — each surface carries its own. Keep the .route() chain
// unbroken: the ui's typed RPC client (`hc<AppType>`, see client.ts) infers
// the route tree from this expression.
export function createApp(deps: AppDeps) {
  return new Hono()
    .route(
      '/ui',
      createUiApp({
        greetingService: deps.greetingService,
        searchService: deps.searchService,
      }),
    )
    .route(
      `/${apiRoutes.prefix}`,
      createApiApp({ greetingService: deps.greetingService }),
    )
    .route('/internal', createInternalApp());
}
