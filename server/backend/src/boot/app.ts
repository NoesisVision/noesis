import { honoLogger } from '@logtape/hono';
import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { createInternalApp } from '#backend/adapters/in/ui/internal.routes';
import { createUiApp, type UiDeps } from '#backend/adapters/in/ui/ui.routes';
import { localHostOnly } from '#backend/platform/http/local-host-only';

// No surface asks who is calling: the server runs on the developer's own
// machine. It does ask which machine is named and which page sent a write, so
// neither a rebound DNS name nor another site's form can reach it.
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
      .use(localHostOnly())
      .use(csrf())
      .route('/ui', createUiApp(deps))
      .route('/internal', createInternalApp())
  );
}
