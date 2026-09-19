import { Hono } from 'hono';
import type { SearchService } from '#backend/app/search/search.service';

export interface SearchDeps {
  searchService: SearchService;
}

export function createSearchApp(deps: SearchDeps) {
  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono().get('/', async (c) => {
    const results = await deps.searchService.search(c.req.query('q') ?? '');
    return c.json({ results });
  });
}
