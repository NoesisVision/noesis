import { Hono } from 'hono';
import type { SearchService } from './search.service.js';

export interface SearchDeps {
  searchService: SearchService;
}

// Mounted at `/ui/search` by the ui surface. The response type is inferred
// from this handler into the route tree, so a typed client in the frontend
// gets the `SearchResult` shape without a shared contracts package.
export function createSearchApp(deps: SearchDeps) {
  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono().get('/', async (c) => {
    const results = await deps.searchService.search(c.req.query('q') ?? '');
    return c.json({ results });
  });
}
