import { generateKeyPairSync, randomBytes } from 'node:crypto';
import type { GithubAuthConfig } from '../config/config.js';
import type { FetchLike } from './github.service.js';

// GitHub is reached through a `fetch`-shaped function injected into
// GithubService, so the whole sign-in flow is exercised with no network and no
// mock library — just this hand-written stand-in.
//
// It lives in `src/` rather than `test/` because it is also what backs
// `NOESIS_AUTH_MODE=local` (see auth.module.ts): one stand-in drives both the
// suites and local development, so a flow that works in dev is a flow the
// tests reach the same way.

export interface FakeGithubOptions {
  profile?: Partial<FakeProfile>;
  installations?: FakeInstallation[];
  /** Repositories reachable per installation id, served on both listing endpoints. */
  repositories?: Record<number, FakeRepository[]>;
  /** Seconds until the access token expires; the default matches GitHub's 8 h. */
  accessTtlSeconds?: number;
  /** Seconds until the refresh token expires; the default matches GitHub's 6 months. */
  refreshTtlSeconds?: number;
  /**
   * Multi-account mode: every entry may sign in, and the OAuth `code` *is* the
   * login. Omit it and the fake serves the single `profile` to any valid code,
   * which is what the suites want.
   */
  accounts?: FakeAccount[];
}

export interface FakeProfile {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

export interface FakeInstallation {
  id: number;
  account: { login: string; type: string };
  repository_selection: string;
}

/** One signable identity in multi-account mode. */
export interface FakeAccount {
  profile: FakeProfile;
  /** What this account reaches; repositories stay global, keyed by installation id. */
  installations: FakeInstallation[];
}

export interface FakeRepository {
  id: number;
  full_name: string;
  private: boolean;
}

export interface FakeGithub {
  fetch: FetchLike;
  /** Every request that reached the fake, in order, as `METHOD path`. */
  calls: string[];
  /** Codes the exchange endpoint will accept; anything else is `bad_verification_code`. */
  validCodes: Set<string>;
  /** Refresh tokens the refresh endpoint will accept. */
  validRefreshTokens: Set<string>;
  profile: FakeProfile;
  installations: FakeInstallation[];
  /** Signable identities; empty unless the fake was built in multi-account mode. */
  accounts: FakeAccount[];
  /** Repositories reachable per installation id — mutate to simulate grants/revocations. */
  repositories: Record<number, FakeRepository[]>;
  /** Installation ids whose repository listing answers 404 (uninstalled/suspended). */
  goneInstallations: Set<number>;
  /** Access tokens minted so far, oldest first. */
  issuedAccessTokens: string[];
  /** Forces the next OAuth call to answer with a GitHub error body. */
  failNextExchangeWith?: string;
}

const DEFAULT_PROFILE: FakeProfile = {
  id: 4711,
  login: 'octocat',
  name: 'The Octocat',
  avatar_url: 'https://avatars.githubusercontent.com/u/4711',
  email: 'octocat@example.com',
};

export function createFakeGithub(options: FakeGithubOptions = {}): FakeGithub {
  const state: FakeGithub = {
    calls: [],
    validCodes: new Set(['good-code']),
    validRefreshTokens: new Set(['refresh-0']),
    profile: { ...DEFAULT_PROFILE, ...options.profile },
    installations: options.installations ?? [],
    accounts: options.accounts ?? [],
    repositories: options.repositories ?? {},
    goneInstallations: new Set(),
    issuedAccessTokens: [],
    fetch: (() => {
      throw new Error('unreachable');
    }) as unknown as FetchLike,
  };

  const accessTtl = options.accessTtlSeconds ?? 8 * 60 * 60;
  const refreshTtl = options.refreshTtlSeconds ?? 6 * 30 * 24 * 60 * 60;
  let counter = 0;
  // Which identity each token speaks for. Single-account mode never consults
  // it — every lookup below falls back to the one profile.
  const tokenOwner = new Map<string, string>();
  const refreshByLogin = new Map<string, string>();

  function mintPair(login: string) {
    counter += 1;
    const accessToken = `access-${counter}`;
    const refresh = `refresh-${counter}`;
    state.issuedAccessTokens.push(accessToken);
    tokenOwner.set(accessToken, login);
    tokenOwner.set(refresh, login);
    // Single-use refresh tokens, exactly like GitHub's: the pair that minted
    // this one is dead, which is what makes the concurrent-refresh case real.
    // Only *this* login's previous token is retired, so one account signing in
    // does not log the others out.
    refreshByLogin.set(login, refresh);
    state.validRefreshTokens = new Set(refreshByLogin.values());
    return {
      access_token: accessToken,
      token_type: 'bearer',
      // GitHub Apps answer with an empty scope; oauth-methods reads it
      // unconditionally, so the fake has to carry it too.
      scope: '',
      expires_in: accessTtl,
      refresh_token: refresh,
      refresh_token_expires_in: refreshTtl,
    };
  }

  function defaultLogin(): string {
    return state.accounts[0]?.profile.login ?? state.profile.login;
  }

  /** The identity a bearer token speaks for; single-account mode has only one. */
  function accountFor(token: string | undefined): FakeAccount | undefined {
    if (state.accounts.length === 0) return undefined;
    const login = token === undefined ? undefined : tokenOwner.get(token);
    return (
      state.accounts.find((a) => a.profile.login === login) ?? state.accounts[0]
    );
  }

  /** The credential on an outbound call, scheme stripped. */
  function bearer(init?: RequestInit): string | undefined {
    const raw =
      init?.headers instanceof Headers
        ? init.headers.get('authorization')
        : ((init?.headers as Record<string, string> | undefined)
            ?.authorization ?? null);
    return /^\S+\s+(.+)$/.exec(raw ?? '')?.[1];
  }

  state.fetch = (async (
    input: Parameters<FetchLike>[0],
    init?: RequestInit,
  ) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    state.calls.push(`${method} ${url.pathname}`);

    if (url.pathname === '/login/oauth/access_token') {
      const body = parseBody(init?.body);
      if (state.failNextExchangeWith !== undefined) {
        const error = state.failNextExchangeWith;
        state.failNextExchangeWith = undefined;
        return json({
          error,
          error_description: `fake failure: ${error}`,
          error_uri: 'https://docs.github.com/',
        });
      }
      if (body.grant_type === 'refresh_token') {
        const refresh = String(body.refresh_token);
        if (!state.validRefreshTokens.has(refresh)) {
          return json({
            error: 'bad_refresh_token',
            error_description: 'The refresh token is invalid.',
            error_uri: 'https://docs.github.com/',
          });
        }
        return json(mintPair(tokenOwner.get(refresh) ?? defaultLogin()));
      }
      // In multi-account mode the code *is* the login — that is what lets
      // `/auth/login?as=<login>` choose who signs in with no round trip.
      const code = String(body.code);
      const named = state.accounts.find((a) => a.profile.login === code);
      if (named === undefined && !state.validCodes.has(code)) {
        return json({
          error: 'bad_verification_code',
          error_description: 'The code passed is incorrect or expired.',
          error_uri: 'https://docs.github.com/',
        });
      }
      return json(mintPair(named?.profile.login ?? defaultLogin()));
    }

    if (url.pathname === '/user') {
      return json(accountFor(bearer(init))?.profile ?? state.profile);
    }

    if (url.pathname === '/user/installations') {
      const installations =
        accountFor(bearer(init))?.installations ?? state.installations;
      return json({ total_count: installations.length, installations });
    }

    // User-side picker source: what the acting user reaches through one
    // installation. The fake serves the installation's whole set.
    const userInstallationRepos =
      /^\/user\/installations\/(\d+)\/repositories$/.exec(url.pathname);
    if (userInstallationRepos !== null) {
      const id = Number(userInstallationRepos[1]);
      const acting = accountFor(bearer(init));
      const reaches =
        acting === undefined || acting.installations.some((i) => i.id === id);
      if (state.goneInstallations.has(id) || !reaches) {
        return json({ message: 'Not Found' }, 404);
      }
      return json(repositoriesPage(state.repositories[id] ?? [], url));
    }

    // App JWT → installation token (GhAppService's outbound call). The minted
    // token encodes the installation id so `/installation/repositories` below
    // knows whose set to serve.
    const installationToken =
      /^\/app\/installations\/(\d+)\/access_tokens$/.exec(url.pathname);
    if (installationToken !== null) {
      return json(
        {
          token: `ghs_${installationToken[1]}`,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
        201,
      );
    }

    // Installation-token side: everything the App reaches through the calling
    // installation — the access check's ground truth (projects.md §3).
    if (url.pathname === '/installation/repositories') {
      const match = /ghs_(\d+)/.exec(bearer(init) ?? '');
      const id = match ? Number(match[1]) : Number.NaN;
      if (!match || state.goneInstallations.has(id)) {
        return json({ message: 'Not Found' }, 404);
      }
      return json(repositoriesPage(state.repositories[id] ?? [], url));
    }

    return json({ message: `fake github: no route for ${url.pathname}` }, 404);
  }) as unknown as FetchLike;

  return state;
}

// Honours `page`/`per_page` like GitHub, so the hand-rolled pagination in
// GithubService is actually exercised.
function repositoriesPage(all: FakeRepository[], url: URL) {
  const perPage = Number(url.searchParams.get('per_page') ?? '30');
  const page = Number(url.searchParams.get('page') ?? '1');
  return {
    total_count: all.length,
    repositories: all.slice((page - 1) * perPage, page * perPage),
  };
}

function parseBody(body: RequestInit['body']): Record<string, unknown> {
  if (typeof body !== 'string') return {};
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return Object.fromEntries(new URLSearchParams(body));
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // oauth-methods anchors token expiry on the response's `Date` header
      // (GitHub's clock, not ours), so it has to be present.
      date: new Date().toUTCString(),
    },
  });
}

let cachedPrivateKey: string | undefined;

/** A real RSA key, so `@octokit/auth-app` can actually sign an App JWT. */
export function testPrivateKey(): string {
  if (cachedPrivateKey === undefined) {
    cachedPrivateKey = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    }).privateKey;
  }
  return cachedPrivateKey;
}

export function testAuthConfig(
  overrides: Partial<GithubAuthConfig> = {},
): GithubAuthConfig {
  return {
    mode: 'github',
    publicUrl: 'https://noesis.example',
    appId: '12345',
    appSlug: 'noesis-test',
    clientId: 'Iv1.testclientid',
    clientSecret: 'test-client-secret',
    privateKey: testPrivateKey(),
    tokenKey: randomBytes(32),
    ...overrides,
  };
}
