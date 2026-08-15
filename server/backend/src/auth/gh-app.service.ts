import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from 'octokit';
import type { GithubAuthConfig } from '../config/config.js';
import type { FetchLike } from './github.service.js';

/**
 * The App's *own* identity — the second of the two authentication paths a
 * GitHub App carries (decision 46). Where `GithubService` acts as the
 * signed-in user, this acts as the App: a JWT signed with the private key,
 * exchanged for a one-hour installation token, with no user present.
 *
 * Nothing calls it yet. It lands with sign-in because it is the same App
 * registration and the same configuration; its consumers — background
 * scanning and the webhook receiver — arrive with repository ingestion.
 */
export class GhAppService {
  private readonly config: GithubAuthConfig;
  private readonly fetchImpl: FetchLike;

  constructor(
    config: GithubAuthConfig,
    fetchImpl: FetchLike = globalThis.fetch,
  ) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  /** Authenticated as the App itself: registration-level endpoints only. */
  appOctokit(): Octokit {
    return new Octokit({
      authStrategy: createAppAuth,
      auth: { appId: this.config.appId, privateKey: this.config.privateKey },
      request: { fetch: this.fetchImpl },
    });
  }

  /**
   * Authenticated as one installation. The token lasts an hour and the auth
   * strategy caches and re-mints it, so callers may hold the client.
   */
  installationOctokit(installationId: string): Octokit {
    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: this.config.appId,
        privateKey: this.config.privateKey,
        installationId: Number(installationId),
      },
      request: { fetch: this.fetchImpl },
    });
  }
}
