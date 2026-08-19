import { type Context, Hono } from 'hono';
import {
  clearReturnToCookie,
  clearSessionCookie,
  clearStateCookie,
  readReturnToCookie,
  readSessionCookie,
  readStateCookie,
  setReturnToCookie,
  setSessionCookie,
  setStateCookie,
} from './auth.cookies.js';
import {
  type AuthModule,
  authModeName,
  type GithubAuthModule,
} from './auth.module.js';
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
    // Read by the sign-in page before any session exists, so it knows whether
    // to offer one GitHub button or one button per local identity. It reveals
    // nothing a deployment's login screen does not already show.
    .get('/mode', (c) => {
      const fake = module.mode === 'disabled' ? undefined : module.fake;
      return c.json({
        mode: authModeName(module),
        accounts: (fake?.accounts ?? []).map((account) => ({
          login: account.profile.login,
          name: account.profile.name ?? account.profile.login,
        })),
      });
    })

    .get('/login', async (c) => {
      if (module.mode === 'disabled') return c.redirect('/');
      const state = randomToken();
      await setStateCookie(c, state, module.stateSecret, module.secureCookies);
      if (module.fake !== undefined) {
        return c.redirect(localAuthorization(c, module, state));
      }
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
      // Where to land after the round-trip (projects.md §2): carried in its
      // own signed cookie, so the connect flow the user left is the one they
      // come back to. An absent or unsafe value falls back to /settings.
      const returnTo = safeReturnTo(c.req.query('returnTo'));
      if (returnTo !== undefined) {
        await setReturnToCookie(
          c,
          returnTo,
          module.stateSecret,
          module.secureCookies,
        );
      }
      if (module.fake !== undefined) {
        // There is no install screen to visit, so local mode names an
        // installation the acting account can see and lets the callback below
        // run the real link step against it.
        const id =
          c.req.query('installation') ?? (await localInstallationId(c, module));
        const params = new URLSearchParams({ state });
        // Absent id means the account reaches nothing — the same shape GitHub
        // sends for `setup_action=request`, and handled as such downstream.
        if (id !== undefined) params.set('installation_id', id);
        return c.redirect(`/auth/install/callback?${params.toString()}`);
      }
      return c.redirect(module.github.installUrl(state));
    })

    // GitHub redirects here after its install screen with `installation_id`
    // and `setup_action`. The id is a claim, not proof — linkInstallation
    // confirms it against the App's API before writing anything.
    .get('/install/callback', async (c) => {
      if (module.mode === 'disabled') return c.redirect('/settings');
      // The returnTo cookie is consumed either way — it is good for exactly
      // one round-trip, like the state cookie.
      const base =
        safeReturnTo(await readReturnToCookie(c, module.stateSecret)) ??
        '/settings';
      clearReturnToCookie(c, module.secureCookies);

      const check = await consumeState(c, module);
      if (!check.ok) {
        return c.redirect(installOutcome(base, 'error', check.reason));
      }

      const token = readSessionCookie(c);
      const session =
        token === undefined ? null : await module.sessions.verify(token);
      if (session === null) return c.redirect('/login');

      const installationId = c.req.query('installation_id');
      if (installationId === undefined || installationId === '') {
        // `setup_action=request` — the user asked an org admin to approve the
        // install, so there is nothing to link yet.
        return c.redirect(installOutcome(base, 'requested'));
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
          linked
            ? installOutcome(base, 'connected')
            : installOutcome(base, 'error', 'not_visible'),
        );
      } catch (error) {
        console.warn(`[auth] install callback failed: ${String(error)}`);
        return c.redirect(installOutcome(base, 'error', 'install_failed'));
      }
    });

  return app;
}

/**
 * Local mode's stand-in for the trip to github.com: straight back to our own
 * callback, carrying the chosen login as the authorization code — which is
 * precisely what the in-memory GitHub's token endpoint accepts. Everything
 * after the redirect (exchange, admission, session) is the real code path.
 */
function localAuthorization(
  c: Context,
  module: GithubAuthModule,
  state: string,
): string {
  const as = c.req.query('as') ?? module.fake?.accounts[0]?.profile.login ?? '';
  return `/auth/callback?${new URLSearchParams({ code: as, state }).toString()}`;
}

/** The first installation the signed-in local account reaches, if any. */
async function localInstallationId(
  c: Context,
  module: GithubAuthModule,
): Promise<string | undefined> {
  const token = readSessionCookie(c);
  const session =
    token === undefined ? null : await module.sessions.verify(token);
  if (session === null) return undefined;
  const account = module.fake?.accounts.find(
    (candidate) => candidate.profile.id === session.account.gh_user_id,
  );
  const installation = account?.installations[0];
  return installation === undefined ? undefined : String(installation.id);
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

/**
 * Only a same-origin relative path may steer the post-install redirect —
 * anything else (absolute URLs, protocol-relative `//host`, backslash
 * variants) is an open-redirect vector and is dropped.
 */
function safeReturnTo(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!value.startsWith('/') || value.startsWith('//')) return undefined;
  if (value.includes('\\')) return undefined;
  return value;
}

/** Appends the install outcome to the return target, preserving its own query. */
function installOutcome(
  base: string,
  install: 'connected' | 'requested' | 'error',
  reason?: string,
): string {
  const url = new URL(base, 'http://relative.invalid');
  url.searchParams.set('install', install);
  if (reason !== undefined) url.searchParams.set('reason', reason);
  return `${url.pathname}?${url.searchParams.toString()}`;
}
