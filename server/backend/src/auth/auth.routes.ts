import { type Context, Hono } from 'hono';
import {
  clearSessionCookie,
  clearStateCookie,
  readSessionCookie,
  readStateCookie,
  setSessionCookie,
  setStateCookie,
} from './auth.cookies.js';
import type { AuthModule, GithubAuthModule } from './auth.module.js';
import { randomToken, safeEqual } from './crypto.js';
import { GithubAuthError } from './github.service.js';

export interface AuthDeps {
  authModule: AuthModule;
}

/**
 * The fourth top-level surface (decision 46). Its consumer is the browser's
 * address bar — 302s and cookies — not the typed JSON RPC contract `/ui` owes
 * `hc<AppType>`, which is why it is a surface of its own under decision 18's
 * criterion rather than a corner of `/ui`. It also stays outside the guarded
 * sub-app, so there is no "unguarded routes inside a guarded app" ordering
 * problem to get wrong.
 */
export function createAuthApp(deps: AuthDeps) {
  const module = deps.authModule;

  const app = new Hono()
    .get('/login', async (c) => {
      if (module.mode === 'disabled') return c.redirect('/');
      const state = randomToken();
      await setStateCookie(c, state, module.stateSecret, module.secureCookies);
      return c.redirect(module.github.authorizationUrl(state));
    })

    .get('/callback', async (c) => {
      if (module.mode === 'disabled') return c.redirect('/');
      const check = await consumeState(c, module);
      if (!check.ok) return c.redirect(loginError(check.reason));

      const code = c.req.query('code');
      if (code === undefined || code === '') {
        return c.redirect(loginError('missing_code'));
      }

      try {
        const result = await module.auth.signInWithCode(
          code,
          readSessionCookie(c),
        );
        if (!result.ok) {
          return c.redirect(loginError(result.reason, result.login));
        }
        setSessionCookie(c, result.token, module.secureCookies);
        return c.redirect('/');
      } catch (error) {
        console.warn(`[auth] sign-in failed: ${String(error)}`);
        return c.redirect(
          loginError(
            error instanceof GithubAuthError ? error.reason : 'github_error',
          ),
        );
      }
    })

    .post('/logout', async (c) => {
      if (module.mode === 'github') {
        const token = readSessionCookie(c);
        if (token !== undefined) await module.sessions.revoke(token);
        clearSessionCookie(c, module.secureCookies);
      }
      return c.body(null, 204);
    })

    .get('/install', async (c) => {
      if (module.mode === 'disabled') return c.redirect('/');
      const state = randomToken();
      await setStateCookie(c, state, module.stateSecret, module.secureCookies);
      return c.redirect(module.github.installUrl(state));
    })

    // GitHub redirects here after its install screen with `installation_id`
    // and `setup_action`. The id is a claim, not proof — linkInstallation
    // confirms it against the App's API before writing anything.
    .get('/install/callback', async (c) => {
      if (module.mode === 'disabled') return c.redirect('/settings');
      const check = await consumeState(c, module);
      if (!check.ok) return c.redirect(settingsError(check.reason));

      const token = readSessionCookie(c);
      const session =
        token === undefined ? null : await module.sessions.verify(token);
      if (session === null) return c.redirect('/login');

      const installationId = c.req.query('installation_id');
      if (installationId === undefined || installationId === '') {
        // `setup_action=request` — the user asked an org admin to approve the
        // install, so there is nothing to link yet.
        return c.redirect('/settings?install=requested');
      }

      try {
        const accessToken = await module.ghTokens.getAccessToken(
          session.account.id,
        );
        const linked = await module.auth.linkInstallation(
          session.account.id,
          accessToken,
          installationId,
        );
        return c.redirect(
          linked ? '/settings?install=connected' : settingsError('not_visible'),
        );
      } catch (error) {
        console.warn(`[auth] install callback failed: ${String(error)}`);
        return c.redirect(settingsError('install_failed'));
      }
    });

  return app;
}

type StateCheck = { ok: true } | { ok: false; reason: string };

/**
 * GitHub does not support PKCE, so the `state` parameter — compared against a
 * separate signed cookie — is the whole CSRF defence on this flow. The cookie
 * is cleared either way: a state is good for exactly one callback.
 */
async function consumeState(
  c: Context,
  module: GithubAuthModule,
): Promise<StateCheck> {
  const expected = await readStateCookie(c, module.stateSecret);
  clearStateCookie(c, module.secureCookies);
  const actual = c.req.query('state');
  if (expected === undefined || actual === undefined) {
    return { ok: false, reason: 'invalid_state' };
  }
  return safeEqual(expected, actual)
    ? { ok: true }
    : { ok: false, reason: 'invalid_state' };
}

// The SPA renders these in place of the sign-in button; `login` lets the
// not-invited message name the account the user is actually signed in as on
// GitHub, which is the one thing that makes the message actionable.
function loginError(reason: string, login?: string): string {
  const params = new URLSearchParams({ error: reason });
  if (login !== undefined) params.set('login', login);
  return `/login?${params.toString()}`;
}

function settingsError(reason: string): string {
  return `/settings?${new URLSearchParams({ install: 'error', reason }).toString()}`;
}
