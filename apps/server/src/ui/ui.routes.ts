import { Hono } from 'hono';
import type { GreetingService } from '../greeting/greeting.service.js';

// The module's dependency contract — the explicit allow-list of what these
// routes may touch. Nothing outside this interface is in scope for the handlers.
export interface UiDeps {
  greetingService: GreetingService;
}

// Endpoints under the `ui` prefix (mounted in app.ts) will carry ui-session
// auth (separate from the `api` surface). The ui app reaches them through the
// typed RPC client (`hc<AppType>`), so paths need no shared constants — rename
// a route and the ui stops compiling.
export function createUiApp(deps: UiDeps) {
  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono().get('/hello', (c) =>
    c.text(deps.greetingService.getHello()),
  );
}
