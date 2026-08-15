import {
  deleteAuthorization,
  exchangeWebFlowCode,
  getWebFlowAuthorizationUrl,
  refreshToken,
} from '@octokit/oauth-methods';
import { request as octokitRequest } from '@octokit/request';
import { Octokit } from 'octokit';
import type { GithubAuthConfig } from '../config/config.js';

/**
 * A user-to-server token pair as this system stores it: absolute ISO instants
 * rather than GitHub's relative `expires_in`, so a row read years later still
 * means the same thing.
 */
export interface GhTokenPair {
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
}

export interface GhProfileResponse {
  ghUserId: number;
  login: string;
  name: string;
  avatarUrl: string;
  email: string;
}

export interface GhInstallationSummary {
  id: string;
  accountLogin: string;
  accountType: string;
  repositorySelection: string;
}

/** GitHub said no. Carries a slug the callback can put in `/login?error=`. */
export class GithubAuthError extends Error {
  readonly reason: string;

  constructor(reason: string, message: string) {
    super(message);
    this.name = 'GithubAuthError';
    this.reason = reason;
  }
}

/** The token pair is dead and no refresh can revive it: sign in again. */
export class GhCredentialExpiredError extends Error {
  constructor(message = 'GitHub credential expired; sign in again.') {
    super(message);
    this.name = 'GhCredentialExpiredError';
  }
}

export type FetchLike = typeof globalThis.fetch;

/**
 * Every outbound call to GitHub on behalf of a *user*. The HTTP transport is a
 * constructor dependency — a `fetch`-shaped function — so route and service
 * specs drive the whole flow without a network or a mock library.
 *
 * The App's own server-to-server tokens are a different concern and live in
 * `GhAppService`.
 */
export class GithubService {
  private readonly config: GithubAuthConfig;
  private readonly request: typeof octokitRequest;
  private readonly fetchImpl: FetchLike;

  constructor(
    config: GithubAuthConfig,
    fetchImpl: FetchLike = globalThis.fetch,
  ) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.request = octokitRequest.defaults({
      request: { fetch: fetchImpl },
    });
  }

  get redirectUrl(): string {
    return `${this.config.publicUrl}/auth/callback`;
  }

  /** Where `GET /auth/login` sends the browser. */
  authorizationUrl(state: string): string {
    const { url } = getWebFlowAuthorizationUrl({
      clientType: 'github-app',
      clientId: this.config.clientId,
      redirectUrl: this.redirectUrl,
      state,
    });
    return url;
  }

  /**
   * The App's installation page. GitHub appends `installation_id` and
   * `setup_action` to the App's registered setup URL, so the callback path is
   * fixed at registration time and only `state` travels from here.
   */
  installUrl(state: string): string {
    const url = new URL(
      `https://github.com/apps/${this.config.appSlug}/installations/new`,
    );
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCode(code: string): Promise<GhTokenPair> {
    const response = await this.call(() =>
      exchangeWebFlowCode({
        clientType: 'github-app',
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        redirectUrl: this.redirectUrl,
        code,
        request: this.request,
      }),
    );
    return toTokenPair(response.authentication);
  }

  async refresh(token: string): Promise<GhTokenPair> {
    const response = await this.call(() =>
      refreshToken({
        clientType: 'github-app',
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        refreshToken: token,
        request: this.request,
      }),
    );
    return toTokenPair(response.authentication);
  }

  /** Best-effort revocation on logout; a failure here must not block the logout. */
  async revoke(accessToken: string): Promise<void> {
    await deleteAuthorization({
      clientType: 'github-app',
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      token: accessToken,
      request: this.request,
    });
  }

  octokitFor(accessToken: string): Octokit {
    return new Octokit({
      auth: accessToken,
      request: { fetch: this.fetchImpl },
    });
  }

  async fetchProfile(accessToken: string): Promise<GhProfileResponse> {
    const { data } =
      await this.octokitFor(accessToken).rest.users.getAuthenticated();
    return {
      ghUserId: data.id,
      login: data.login,
      // GitHub leaves these null for accounts that never filled them in; the
      // graph columns are plain STRING, so normalize at the edge.
      name: data.name ?? data.login,
      avatarUrl: data.avatar_url ?? '',
      email: data.email ?? '',
    };
  }

  /** The installations *this user* can see, which is what the account may use. */
  async listInstallations(
    accessToken: string,
  ): Promise<GhInstallationSummary[]> {
    const { data } = await this.octokitFor(
      accessToken,
    ).rest.apps.listInstallationsForAuthenticatedUser({ per_page: 100 });
    return data.installations.map((installation) => ({
      id: String(installation.id),
      accountLogin: accountLoginOf(installation.account),
      accountType: accountTypeOf(installation.account),
      repositorySelection: installation.repository_selection ?? 'selected',
    }));
  }

  async fetchInstallation(
    accessToken: string,
    installationId: string,
  ): Promise<GhInstallationSummary | null> {
    const installations = await this.listInstallations(accessToken);
    return installations.find((i) => i.id === installationId) ?? null;
  }

  // GitHub's OAuth endpoints answer 200 with an `error` body; oauth-methods
  // turns that into a throw. Everything from here up is one failure mode —
  // "GitHub refused" — so it gets one error type carrying a redirectable slug.
  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new GithubAuthError('github_error', message);
    }
  }
}

function toTokenPair(authentication: {
  token: string;
  expiresAt?: string;
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
}): GhTokenPair {
  if (
    authentication.expiresAt === undefined ||
    authentication.refreshToken === undefined ||
    authentication.refreshTokenExpiresAt === undefined
  ) {
    // Reached only if the App has "expiring user tokens" switched off, which
    // would silently give Noesis a token it can neither refresh nor age out.
    throw new GithubAuthError(
      'expiring_tokens_disabled',
      'The GitHub App must have expiring user tokens enabled.',
    );
  }
  return {
    accessToken: authentication.token,
    accessExpiresAt: new Date(authentication.expiresAt).toISOString(),
    refreshToken: authentication.refreshToken,
    refreshExpiresAt: new Date(
      authentication.refreshTokenExpiresAt,
    ).toISOString(),
  };
}

type InstallationAccount = {
  login?: string;
  slug?: string;
  type?: string;
} | null;

function accountLoginOf(account: unknown): string {
  const value = account as InstallationAccount;
  return value?.login ?? value?.slug ?? 'unknown';
}

function accountTypeOf(account: unknown): string {
  return (account as InstallationAccount)?.type ?? 'Organization';
}
