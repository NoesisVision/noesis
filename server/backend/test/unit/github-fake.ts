import { generateKeyPairSync, randomBytes } from 'node:crypto';
import type { FetchLike } from '../../src/auth/github.service.js';
import type { GithubAuthConfig } from '../../src/config/config.js';

// GitHub is reached through a `fetch`-shaped function injected into
// GithubService, so the whole sign-in flow is exercised with no network and no
// mock library — just this hand-written stand-in.

export interface FakeGithubOptions {
  profile?: Partial<FakeProfile>;
  installations?: FakeInstallation[];
  /** Seconds until the access token expires; the default matches GitHub's 8 h. */
  accessTtlSeconds?: number;
  /** Seconds until the refresh token expires; the default matches GitHub's 6 months. */
  refreshTtlSeconds?: number;
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
    issuedAccessTokens: [],
    fetch: (() => {
      throw new Error('unreachable');
    }) as unknown as FetchLike,
  };

  const accessTtl = options.accessTtlSeconds ?? 8 * 60 * 60;
  const refreshTtl = options.refreshTtlSeconds ?? 6 * 30 * 24 * 60 * 60;
  let counter = 0;

  function mintPair() {
    counter += 1;
    const accessToken = `access-${counter}`;
    const refresh = `refresh-${counter}`;
    state.issuedAccessTokens.push(accessToken);
    // Single-use refresh tokens, exactly like GitHub's: the pair that minted
    // this one is dead, which is what makes the concurrent-refresh case real.
    state.validRefreshTokens = new Set([refresh]);
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
        if (!state.validRefreshTokens.has(String(body.refresh_token))) {
          return json({
            error: 'bad_refresh_token',
            error_description: 'The refresh token is invalid.',
            error_uri: 'https://docs.github.com/',
          });
        }
        return json(mintPair());
      }
      if (!state.validCodes.has(String(body.code))) {
        return json({
          error: 'bad_verification_code',
          error_description: 'The code passed is incorrect or expired.',
          error_uri: 'https://docs.github.com/',
        });
      }
      return json(mintPair());
    }

    if (url.pathname === '/user') return json(state.profile);

    if (url.pathname === '/user/installations') {
      return json({
        total_count: state.installations.length,
        installations: state.installations,
      });
    }

    // App JWT → installation token (GhAppService's only outbound call).
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

    return json({ message: `fake github: no route for ${url.pathname}` }, 404);
  }) as unknown as FetchLike;

  return state;
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
