import { Hono } from 'hono';

// Technical endpoints (`/internal/*`): health checks, future readiness/metrics.
// No external client package imports these paths — the healthcheck is
// configured with the literal `/internal/health`.
export function createInternalApp() {
  return new Hono().get('/health', (c) => c.json({ status: 'ok' as const }));
}
