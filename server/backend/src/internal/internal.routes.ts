import { Hono } from 'hono';

// Technical endpoints (`/internal/*`): health checks, future readiness/metrics.
// No client package imports these paths — the e2e specs wait on the literal
// `/internal/health`.
export function createInternalApp() {
  return new Hono().get('/health', (c) => c.json({ status: 'ok' as const }));
}
