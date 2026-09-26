import { honoLogger } from '@logtape/hono';
import { Hono } from 'hono';
import { createInternalApp } from '#backend/adapters/in/ui/internal.routes';
import { createUiApp, type UiDeps } from '#backend/adapters/in/ui/ui.routes';

// No surface is guarded: the server runs on the developer's own machine.
// Keep the .route() chain unbroken: Hono infers the route tree from this
// expression for the typed RPC client (`hc`).
export function createApp(deps: UiDeps) {
  return (
    new Hono()
      // `context: true` gives every log line in the request its request id.
      .use(
        honoLogger({
          category: ['noesis', 'server', 'http'],
          format: 'structured-common',
          context: true,
          skip: (c) => c.req.path === '/internal/health',
        }),
      )
      .route('/ui', createUiApp(deps))
      .route('/internal', createInternalApp())
  );
}
