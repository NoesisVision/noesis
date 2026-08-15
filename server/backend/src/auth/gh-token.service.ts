import type { Octokit } from 'octokit';
import { ConcurrencyConflictError } from '../database/concurrency.js';
import type { AuthRepository, CredentialRow } from './auth.repository.js';
import { decryptSecret, encryptSecret } from './crypto.js';
import {
  GhCredentialExpiredError,
  type GithubService,
} from './github.service.js';

/**
 * A token that expires inside this window is treated as already expired, so a
 * request never leaves with a token that dies in flight.
 */
export const REFRESH_SKEW_MS = 60_000;

/**
 * The only way handler code obtains a GitHub client for a user. Centralising it
 * means the refresh cycle — decrypt, check expiry, refresh, re-encrypt, write
 * back — exists once, and no caller can accidentally hold a stale token.
 */
export class GhTokenService {
  private readonly repo: AuthRepository;
  private readonly github: GithubService;
  private readonly tokenKey: Buffer;
  private readonly now: () => Date;

  // A refresh consumes the refresh token and mints a new pair, so two
  // concurrent refreshes for one account would leave the loser holding a dead
  // pair. In-process callers therefore share one refresh; the optimistic
  // `version` column below covers the cross-process case.
  private readonly inflight = new Map<string, Promise<string>>();

  constructor(
    repo: AuthRepository,
    github: GithubService,
    tokenKey: Buffer,
    now: () => Date = () => new Date(),
  ) {
    this.repo = repo;
    this.github = github;
    this.tokenKey = tokenKey;
    this.now = now;
  }

  async getUserOctokit(accountId: string): Promise<Octokit> {
    return this.github.octokitFor(await this.getAccessToken(accountId));
  }

  async getAccessToken(accountId: string): Promise<string> {
    const credential = await this.repo.findCredential(accountId);
    if (credential === null) {
      throw new GhCredentialExpiredError('No GitHub credential for account.');
    }
    if (!this.isExpiring(credential.access_expires_at)) {
      return decryptSecret(credential.access_token_enc, this.tokenKey);
    }

    const pending = this.inflight.get(accountId);
    if (pending !== undefined) return pending;

    const refresh = this.refresh(accountId, credential).finally(() => {
      this.inflight.delete(accountId);
    });
    this.inflight.set(accountId, refresh);
    return refresh;
  }

  private isExpiring(expiresAt: string): boolean {
    return (
      new Date(expiresAt).getTime() - this.now().getTime() <= REFRESH_SKEW_MS
    );
  }

  private async refresh(
    accountId: string,
    credential: CredentialRow,
  ): Promise<string> {
    // A dead refresh token (six months, or the install was revoked) is
    // terminal: drop the credential and every session with it, so the ui's 401
    // interceptor sends the user back through sign-in rather than retrying.
    if (this.isExpiring(credential.refresh_expires_at)) {
      await this.dropCredential(accountId);
      throw new GhCredentialExpiredError();
    }

    const pair = await this.github
      .refresh(decryptSecret(credential.refresh_token_enc, this.tokenKey))
      .catch(async (error) => {
        await this.dropCredential(accountId);
        throw error instanceof GhCredentialExpiredError
          ? error
          : new GhCredentialExpiredError(
              `GitHub refused to refresh the credential: ${String(error)}`,
            );
      });

    try {
      // Same step that consumed the response: the previous pair is already
      // dead by the time this runs, so the write cannot be deferred.
      await this.repo.rotateCredential(
        credential.id,
        {
          accessTokenEnc: encryptSecret(pair.accessToken, this.tokenKey),
          accessExpiresAt: pair.accessExpiresAt,
          refreshTokenEnc: encryptSecret(pair.refreshToken, this.tokenKey),
          refreshExpiresAt: pair.refreshExpiresAt,
        },
        credential.version,
      );
      return pair.accessToken;
    } catch (error) {
      if (!(error instanceof ConcurrencyConflictError)) throw error;
      // Another process refreshed first and its pair is the live one; ours is
      // already invalid, so reload rather than overwrite.
      const current = await this.repo.findCredential(accountId);
      if (current === null) throw new GhCredentialExpiredError();
      return decryptSecret(current.access_token_enc, this.tokenKey);
    }
  }

  private async dropCredential(accountId: string): Promise<void> {
    await this.repo.deleteCredential(accountId);
    await this.repo.deleteSessionsForAccount(accountId);
  }
}
