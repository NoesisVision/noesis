import { Hono } from 'hono';
import type { SearchHandler } from '#backend/app/search/search';

export interface SearchDeps {
  search: SearchHandler;
}

export function createSearchApp(deps: SearchDeps) {
  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono().get('/', async (c) => {
    const results = await deps.search.handle(c.req.query('q') ?? '');
    return c.json({ results });
  });
}
