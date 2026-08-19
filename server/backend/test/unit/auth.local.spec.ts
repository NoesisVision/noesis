import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import type { GithubAuthModule } from '../../src/auth/auth.module.js';
import { createAuthModule } from '../../src/auth/auth.module.js';
import { createAuthApp } from '../../src/auth/auth.routes.js';
import type { DatabaseService } from '../../src/database/database.service.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';

// `NOESIS_AUTH_MODE=local` exists so a contributor gets the real flows without
// registering a GitHub App. These assertions are about that claim: the module
// is an ordinary github module, and sign-in, admission and the per-account
// repository views all run their production code against the in-memory GitHub.

let db: DatabaseService;

beforeAll(async () => {
  db = await sharedTestDatabase();
});

afterEach(resetGraph);

function harness() {
  const module = createAuthModule(
    { mode: 'local', publicUrl: 'http://localhost:5173' },
    db,
  ) as GithubAuthModule;
  return { module, app: createAuthApp({ authModule: module }) };
}

function cookiesFrom(res: Response): Map<string, string> {
  const jar = new Map<string, string>();
  for (const header of res.headers.getSetCookie()) {
    const pair = header.split(';')[0] as string;
    const index = pair.indexOf('=');
    jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
  return jar;
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar]
    .filter(([, value]) => value !== '')
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/** The browser's half of the flow, minus the trip to github.com. */
async function signIn(app: ReturnType<typeof harness>['app'], as?: string) {
  const start = await app.request(
    as === undefined ? '/login' : `/login?as=${encodeURIComponent(as)}`,
  );
  const jar = cookiesFrom(start);
  // Relative on purpose: the redirect never leaves this origin.
  const target = start.headers.get('location') as string;
  const callback = await app.request(target.replace(/^\/auth/, ''), {
    headers: { cookie: cookieHeader(jar) },
  });
  return { start, callback, jar: cookiesFrom(callback) };
}

describe('local auth mode', () => {
  it('assembles as a github module, so nothing downstream branches on it', () => {
    const { module } = harness();

    expect(module.mode).toBe('github');
    expect(module.fake).toBeDefined();
  });

  it('reports its identities to the signed-out sign-in page', async () => {
    const { app } = harness();

    const body = (await (await app.request('/mode')).json()) as {
      mode: string;
      accounts: { login: string }[];
    };

    expect(body.mode).toBe('local');
    expect(body.accounts.map((a) => a.login)).toEqual([
      'octocat',
      'alice',
      'bob',
    ]);
  });

  it('sends the browser to our own callback rather than github.com', async () => {
    const { app } = harness();

    const res = await app.request('/login?as=alice');

    const location = res.headers.get('location') as string;
    expect(location.startsWith('/auth/callback?')).toBe(true);
    // The code IS the login — that is the whole mechanism behind `?as=`.
    expect(new URLSearchParams(location.split('?')[1]).get('code')).toBe(
      'alice',
    );
  });

  it('admits the first identity as owner and refuses the next without an invite', async () => {
    const { app, module } = harness();

    const owner = await signIn(app, 'octocat');
    expect(owner.callback.headers.get('location')).toBe('/');

    const alice = await signIn(app, 'alice');
    expect(alice.callback.headers.get('location')).toBe(
      '/login?error=not_invited&login=alice',
    );

    const accounts = await module.auth.listAccounts();
    expect(accounts.map((a) => `${a.login}:${a.role}`)).toEqual([
      'octocat:owner',
    ]);
  });

  it('runs the real invite flow between two local identities', async () => {
    const { app, module } = harness();
    await signIn(app, 'octocat');
    const owner = await module.repo.findAccountByGhUserId(1001);
    if (owner === null) throw new Error('owner was not created');

    await module.auth.invite('alice', owner);
    const alice = await signIn(app, 'alice');

    expect(alice.callback.headers.get('location')).toBe('/');
    const accounts = await module.auth.listAccounts();
    expect(accounts.map((a) => `${a.login}:${a.role}`).sort()).toEqual([
      'alice:member',
      'octocat:owner',
    ]);
  });

  it('gives each identity its own installations and repositories', async () => {
    const { module } = harness();

    const asOctocat = await module.github.exchangeCode('octocat');
    const asAlice = await module.github.exchangeCode('alice');

    const octocatInstallations = await module.github.listInstallations(
      asOctocat.accessToken,
    );
    const aliceInstallations = await module.github.listInstallations(
      asAlice.accessToken,
    );
    expect(octocatInstallations.map((i) => i.id)).toEqual(['1', '2']);
    expect(aliceInstallations.map((i) => i.id)).toEqual(['2']);

    const personal = await module.github.listInstallationRepositories(
      asOctocat.accessToken,
      '1',
    );
    expect(personal.map((r) => r.fullName)).toEqual([
      'octocat/scratchpad',
      'octocat/dotfiles',
    ]);
    // Alice cannot reach the personal installation, and GitHub answers 404
    // there rather than an empty list — so the picker's error path is real too.
    expect(
      module.github.listInstallationRepositories(asAlice.accessToken, '1'),
    ).rejects.toThrow();
  });
});
