import { Hono } from 'hono';
import type { DesignDocsService } from '../design-docs/design-docs.service.js';
import type { GreetingService } from '../greeting/greeting.service.js';
import type { InboxService } from '../inbox/inbox.service.js';
import { createDesignDocsApp } from './design-docs/design-docs.routes.js';
import { createInboxApp } from './inbox/inbox.routes.js';
import { createSearchApp } from './search/search.routes.js';
import type { SearchService } from './search/search.service.js';

// The module's dependency contract — the explicit allow-list of what these
// routes may touch. Nothing outside this interface is in scope for the handlers.
export interface UiDeps {
  greetingService: GreetingService;
  searchService: SearchService;
  designDocsService: DesignDocsService;
  inboxService: InboxService;
}

// Endpoints under the `ui` prefix (mounted in app.ts). The ui app reaches them
// through the typed RPC client (`hc<AppType>`), so paths need no shared
// constants — rename a route and the ui stops compiling. Every entity here is
// top-level: the server serves the one checkout it was started in, so nothing
// is scoped by project or account (decision 65).
export function createUiApp(deps: UiDeps) {
  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/hello', (c) => c.text(deps.greetingService.getHello()))
    .route('/search', createSearchApp({ searchService: deps.searchService }))
    .route('/inbox', createInboxApp({ inboxService: deps.inboxService }))
    .route(
      '/design-docs',
      createDesignDocsApp({ designDocsService: deps.designDocsService }),
    );
}
