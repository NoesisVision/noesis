import { Hono } from 'hono';

// The e2e specs wait on the literal `/internal/health`.
export function createInternalApp() {
  return new Hono().get('/health', (c) => c.json({ status: 'ok' as const }));
}
