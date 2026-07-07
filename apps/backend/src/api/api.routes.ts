import { apiRoutes } from '@repo/local-contracts';
import { Hono } from 'hono';
import type { GreetingService } from '../greeting/greeting.service.js';

export interface ApiDeps {
  greetingService: GreetingService;
}

// The `api` surface is called by the local app (MCP server), which stays on
// the @repo/local-contracts route constants — so this factory defines its
// paths from the same constants and the two sides cannot drift. Endpoints
// here will carry token auth (separate from the `ui` surface).
export function createApiApp(deps: ApiDeps) {
  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono().get(`/${apiRoutes.hello}`, (c) =>
    c.text(deps.greetingService.getHello()),
  );
}
