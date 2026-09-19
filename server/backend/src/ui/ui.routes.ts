import { Hono } from 'hono';
import type { ChangesService } from '#backend/app/changes/changes.service';
import type { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import type { SearchService } from '#backend/app/search/search.service';
import { createChangesApp } from './changes/changes.routes';
import { createDesignDocsApp } from './design-docs/design-docs.routes';
import { createSearchApp } from './search/search.routes';

export interface UiDeps {
  searchService: SearchService;
  changesService: ChangesService;
  designDocsService: DesignDocsService;
}

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
