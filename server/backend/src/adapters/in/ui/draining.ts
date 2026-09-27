import { createMiddleware } from 'hono/factory';
import { errorAnswer } from './error-body';

/**
 * Once the daemon starts to shut down, no write starts and no session
 * attaches: every request answers 503, which a shim takes as the cue to
 * reconnect on its next call.
 */
export function refuseWhileDraining(draining: () => boolean) {
  return createMiddleware(async (c, next) => {
    if (draining()) return errorAnswer(c, { error: 'shutting_down' });
    await next();
  });
}
