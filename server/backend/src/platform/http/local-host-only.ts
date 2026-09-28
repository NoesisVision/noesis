import { createMiddleware } from 'hono/factory';

/** The names the loopback listener answers to; anything else is a rebound DNS name. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Refuses a request whose `Host` names anything but this machine. Listening
 * on loopback does not do that: a page on an attacker's domain whose DNS is
 * then re-pointed at 127.0.0.1 reaches the port with its own name in `Host`,
 * and passes an origin check too. The request url is built from that header,
 * so its hostname is what to check.
 */
export function localHostOnly() {
  return createMiddleware(async (c, next) => {
    if (!LOCAL_HOSTS.has(new URL(c.req.url).hostname)) {
      return c.text('Forbidden', 403);
    }
    await next();
  });
}
