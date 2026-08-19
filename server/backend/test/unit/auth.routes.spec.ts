import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { createAuthModule } from '../../src/auth/auth.module.js';
import { AuthRepository } from '../../src/auth/auth.repository.js';
import { createAuthApp } from '../../src/auth/auth.routes.js';
import {
  createFakeGithub,
  testAuthConfig,
} from '../../src/auth/github-fake.js';
import type { DatabaseService } from '../../src/database/database.service.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';

// The `/auth` surface trades 302s and cookies, so these assertions are about
// redirect targets and Set-Cookie headers rather than JSON bodies. GitHub is
// the injected fake, so nothing here touches the network.

let db: DatabaseService;

beforeAll(async () => {
  db = await sharedTestDatabase();
});

afterEach(resetGraph);

function harness(options: Parameters<typeof createFakeGithub>[0] = {}) {
  const github = createFakeGithub(options);
  const config = testAuthConfig();
  const module = createAuthModule(config, db, github.fetch);
  return {
    github,
    module,
    repo: new AuthRepository(db),
    app: createAuthApp({ authModule: module }),
  };
}

/** The `name=value` pairs a response asks the browser to keep, ready to send back. */
function cookiesFrom(res: Response): Map<string, string> {
  const jar = new Map<string, string>();
  for (const header of res.headers.getSetCookie()) {
    const [pair] = header.split(';');
    const index = (pair as string).indexOf('=');
    jar.set(
      (pair as string).slice(0, index),
      (pair as string).slice(index + 1),
    );
  }
  return jar;
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar]
    .filter(([, value]) => value !== '')
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/** Walks the browser's half of the flow: /auth/login, then back with a code. */
async function signIn(
  app: ReturnType<typeof harness>['app'],
  code: string,
  tamperState?: string,
) {
  const start = await app.request('/login');
  const jar = cookiesFrom(start);
  const state =
    tamperState ??
    (new URL(start.headers.get('location') as string).searchParams.get(
      'state',
    ) as string);

  const callback = await app.request(
    `/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    { headers: { cookie: cookieHeader(jar) } },
  );
  return { start, callback };
}

describe('GET /auth/login', () => {
  it('redirects to GitHub with a state that is also set as a signed cookie', async () => {
    const { app } = harness();

    const res = await app.request('/login');

    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location') as string);
    expect(location.origin).toBe('https://github.com');
    expect(location.pathname).toBe('/login/oauth/authorize');
    expect(location.searchParams.get('client_id')).toBe('Iv1.testclientid');
    expect(location.searchParams.get('redirect_uri')).toBe(
      'https://noesis.example/auth/callback',
    );
    const state = location.searchParams.get('state');
    expect(state).not.toBeNull();

    const cookie = cookiesFrom(res).get('noesis_oauth_state') as string;
    // Signed, so the value is the state plus a signature — never the bare state.
    expect(decodeURIComponent(cookie).startsWith(`${state}.`)).toBe(true);
  });
});

describe('GET /auth/callback', () => {
  it('signs the first user in, sets a session cookie and lands on /', async () => {
    const { app, repo } = harness();

    const { callback } = await signIn(app, 'good-code');

    expect(callback.status).toBe(302);
    expect(callback.headers.get('location')).toBe('/');
    const session = cookiesFrom(callback).get('noesis_session');
    expect(session).toBeTruthy();
    expect(await repo.countAccounts()).toBe(1);

    // HttpOnly and SameSite=Lax: Lax is required, since this very callback is
    // a top-level GET navigation that Strict would have stripped cookies from.
    const header = callback.headers
      .getSetCookie()
      .find((h) => h.startsWith('noesis_session=')) as string;
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Secure');
  });

  it('rejects a state that does not match the cookie', async () => {
    const { app, repo } = harness();

    const { callback } = await signIn(app, 'good-code', 'not-the-state');

    expect(callback.headers.get('location')).toBe('/login?error=invalid_state');
    expect(await repo.countAccounts()).toBe(0);
  });

  it('rejects a callback with no state cookie at all', async () => {
    const { app } = harness();

    const res = await app.request('/callback?code=good-code&state=whatever');

    expect(res.headers.get('location')).toBe('/login?error=invalid_state');
  });

  it('reports a missing code', async () => {
    const { app } = harness();
    const start = await app.request('/login');
    const jar = cookiesFrom(start);
    const state = new URL(
      start.headers.get('location') as string,
    ).searchParams.get('state') as string;

    const res = await app.request(`/callback?state=${state}`, {
      headers: { cookie: cookieHeader(jar) },
    });

    expect(res.headers.get('location')).toBe('/login?error=missing_code');
  });

  it('reports GitHub refusing the code exchange', async () => {
    const { app, repo } = harness();

    const { callback } = await signIn(app, 'expired-code');

    expect(callback.headers.get('location')).toBe('/login?error=github_error');
    expect(await repo.countAccounts()).toBe(0);
  });

  it('sends an uninvited second user back to /login, naming their login', async () => {
    const first = harness();
    await signIn(first.app, 'good-code');

    const second = harness({ profile: { id: 99, login: 'stranger' } });
    second.github.validCodes.add('stranger-code');
    const { callback } = await signIn(second.app, 'stranger-code');

    expect(callback.headers.get('location')).toBe(
      '/login?error=not_invited&login=stranger',
    );
    expect(cookiesFrom(callback).get('noesis_session')).toBeUndefined();
    expect(await second.repo.countAccounts()).toBe(1);
  });

  it('spends a state exactly once', async () => {
    const { app, github } = harness();
    const start = await app.request('/login');
    const jar = cookiesFrom(start);
    const state = new URL(
      start.headers.get('location') as string,
    ).searchParams.get('state') as string;
    github.validCodes.add('second-code');

    const first = await app.request(`/callback?code=good-code&state=${state}`, {
      headers: { cookie: cookieHeader(jar) },
    });
    expect(first.headers.get('location')).toBe('/');

    // The callback cleared the state cookie, so a replay has nothing to match.
    const replayJar = cookiesFrom(first);
    const replay = await app.request(
      `/callback?code=second-code&state=${state}`,
      { headers: { cookie: cookieHeader(replayJar) } },
    );
    expect(replay.headers.get('location')).toBe('/login?error=invalid_state');
  });
});

describe('POST /auth/logout', () => {
  it('deletes the session row and clears the cookie', async () => {
    const { app, module } = harness();
    const { callback } = await signIn(app, 'good-code');
    const jar = cookiesFrom(callback);
    const token = jar.get('noesis_session') as string;
    if (module.mode !== 'github') throw new Error('expected github mode');
    expect(await module.sessions.verify(token)).not.toBeNull();

    const res = await app.request('/logout', {
      method: 'POST',
      headers: { cookie: cookieHeader(jar) },
    });

    expect(res.status).toBe(204);
    expect(await module.sessions.verify(token)).toBeNull();
    expect(
      res.headers.getSetCookie().some((h) => h.startsWith('noesis_session=;')),
    ).toBe(true);
  });

  it('is harmless without a session', async () => {
    const { app } = harness();
    expect((await app.request('/logout', { method: 'POST' })).status).toBe(204);
  });
});

describe('GET /auth/install', () => {
  it('redirects to the App installation page carrying a state', async () => {
    const { app } = harness();

    const res = await app.request('/install');

    const location = new URL(res.headers.get('location') as string);
    expect(
      location.href.startsWith(
        'https://github.com/apps/noesis-test/installations/new',
      ),
    ).toBe(true);
    expect(location.searchParams.get('state')).not.toBeNull();
  });

  it('links an installation the signed-in user can actually see', async () => {
    const { app, module } = harness({
      installations: [
        {
          id: 42,
          account: { login: 'acme', type: 'Organization' },
          repository_selection: 'selected',
        },
      ],
    });
    const { callback } = await signIn(app, 'good-code');
    const sessionJar = cookiesFrom(callback);

    const start = await app.request('/install', {
      headers: { cookie: cookieHeader(sessionJar) },
    });
    const jar = new Map([...sessionJar, ...cookiesFrom(start)]);
    const state = new URL(
      start.headers.get('location') as string,
    ).searchParams.get('state') as string;

    const res = await app.request(
      `/install/callback?installation_id=42&setup_action=install&state=${state}`,
      { headers: { cookie: cookieHeader(jar) } },
    );

    expect(res.headers.get('location')).toBe('/settings?install=connected');
    if (module.mode !== 'github') throw new Error('expected github mode');
    const account = await module.repo.findAccountByGhUserId(4711);
    expect(
      await module.auth.listInstallations(account?.id as string),
    ).toHaveLength(1);
  });

  it('refuses an installation id the user cannot see', async () => {
    const { app } = harness();
    const { callback } = await signIn(app, 'good-code');
    const sessionJar = cookiesFrom(callback);
    const start = await app.request('/install', {
      headers: { cookie: cookieHeader(sessionJar) },
    });
    const jar = new Map([...sessionJar, ...cookiesFrom(start)]);
    const state = new URL(
      start.headers.get('location') as string,
    ).searchParams.get('state') as string;

    const res = await app.request(
      `/install/callback?installation_id=999&state=${state}`,
      { headers: { cookie: cookieHeader(jar) } },
    );

    expect(res.headers.get('location')).toBe(
      '/settings?install=error&reason=not_visible',
    );
  });
});
