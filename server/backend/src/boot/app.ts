import { honoLogger } from '@logtape/hono';
import { Hono } from 'hono';
import { refuseWhileDraining } from '#backend/adapters/in/ui/draining';
import {
  createInternalApp,
  type InternalDeps,
} from '#backend/adapters/in/ui/internal.routes';
import { createUiApp, type UiDeps } from '#backend/adapters/in/ui/ui.routes';
import { localHostOnly } from '#backend/platform/http/local-host-only';
import { serverLogger } from '#backend/platform/logging/server-logger';

export interface AppOptions {
  internal: InternalDeps;
  /** True once shutdown has begun. */
  draining: () => boolean;
}

// No surface asks who is calling: the server runs on the developer's own
// machine. It does ask which machine is named, against DNS rebinding.
// Keep the .route() chain unbroken: Hono infers the route tree from this
// expression for the typed RPC client (`hc`).
export function createApp(deps: UiDeps, options: AppOptions) {
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
      .use(refuseWhileDraining(options.draining))
      .route('/ui', createUiApp(deps))
      .route('/internal', createInternalApp(options.internal))
  );
}
