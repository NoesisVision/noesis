import { Hono } from 'hono';

// Technical endpoints (`/internal/*`): health checks, future readiness/metrics.
// No external client package imports these paths — the Railway healthcheck is
// configured with the literal `/internal/health`. Keep this surface harmless
// while it is publicly reachable; anything sensitive needs auth middleware first.
export function createInternalApp() {
  return new Hono().get('/health', (c) => c.json({ status: 'ok' as const }));
}
