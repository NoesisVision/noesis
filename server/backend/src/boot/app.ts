import { honoLogger } from '@logtape/hono';
import { Hono } from 'hono';
import { createInternalApp } from '#backend/adapters/in/ui/internal.routes';
import { createUiApp, type UiDeps } from '#backend/adapters/in/ui/ui.routes';
import { localHostOnly } from '#backend/platform/http/local-host-only';
import { serverLogger } from '#backend/platform/logging/server-logger';

// No surface asks who is calling: the server runs on the developer's own
// machine. It does ask which machine is named, against DNS rebinding.
// Keep the .route() chain unbroken: Hono infers the route tree from this
// expression for the typed RPC client (`hc`).
export function createApp(deps: UiDeps) {
  return (
    new Hono()
      .use(localHostOnly())
      // `context: true` gives every log line in the request its request id.
      .use(
        honoLogger({
          category: serverLogger('http').category,
          format: 'structured-common',
          context: true,
          skip: (c) => c.req.path === '/internal/health',
        }),
      )
      .route('/ui', createUiApp(deps))
      .route('/internal', createInternalApp())
  );
}
