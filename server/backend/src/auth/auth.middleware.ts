import { createMiddleware } from 'hono/factory';
import { readSessionCookie } from './auth.cookies.js';
import type { AuthModule } from './auth.module.js';
import type { AccountRow } from './auth.repository.js';
import { LOCAL_ACCOUNT } from './auth.service.js';

/**
 * What the guard puts on the context. Handlers downstream read `account` and
 * never touch a cookie themselves.
 */
export interface AuthEnv {
  Variables: {
    account: AccountRow;
    /** Absent in `disabled` mode — there is no real session behind it. */
    sessionToken?: string;
  };
}

/**
 * Guards the `/ui` surface. Answers a bare 401 rather than a redirect: the
 * consumer is `hc<AppType>` from the SPA, and the SPA's own router decides
 * what a signed-out user sees.
 */
export function requireSession(module: AuthModule) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    if (module.mode === 'disabled') {
      // The escape hatch from §4: one fixed local owner, so contributors can
      // run the server and the suites with no GitHub App registered.
      c.set('account', LOCAL_ACCOUNT);
      return next();
    }

    const token = readSessionCookie(c);
    if (token === undefined) return c.json({ error: 'unauthenticated' }, 401);

    const session = await module.sessions.verify(token);
    if (session === null) return c.json({ error: 'unauthenticated' }, 401);

    c.set('account', session.account);
    c.set('sessionToken', token);
    return next();
  });
}

/**
 * Layered on top of `requireSession`. 403 rather than 401: the caller is
 * authenticated and retrying will not help.
 */
export function requireOwner() {
  return createMiddleware<AuthEnv>(async (c, next) => {
    if (c.get('account').role !== 'owner') {
      return c.json({ error: 'forbidden' }, 403);
    }
    return next();
  });
}
