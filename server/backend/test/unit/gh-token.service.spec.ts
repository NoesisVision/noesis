import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { AuthRepository } from '../../src/auth/auth.repository.js';
import { encryptSecret } from '../../src/auth/crypto.js';
import { GhTokenService } from '../../src/auth/gh-token.service.js';
import {
  GhCredentialExpiredError,
  GithubService,
} from '../../src/auth/github.service.js';
import { SessionService } from '../../src/auth/session.service.js';
import type { DatabaseService } from '../../src/database/database.service.js';
import { createFakeGithub, testAuthConfig } from './github-fake.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';

let db: DatabaseService;

const NOW = new Date('2026-08-13T12:00:00.000Z');
const PROFILE = {
  ghUserId: 1,
  login: 'octocat',
  name: 'The Octocat',
  avatarUrl: '',
  email: '',
};

beforeAll(async () => {
  db = await sharedTestDatabase();
});

afterEach(resetGraph);

/** What a competing writer needs to reach the same credential row. */
export interface RefreshRace {
  repo: AuthRepository;
  credentialId: string;
  tokenKey: Buffer;
}

interface Seed {
  accessInMs: number;
  refreshInMs: number;
  /**
   * Runs after GitHub answers a refresh but before the write-back — the exact
   * window a second process would race through.
   */
  duringRefresh?: (race: RefreshRace) => Promise<void>;
}

// Lets a test slip a competing writer into the middle of the refresh, which is
// the only place the optimistic-concurrency branch can be reached.
class RacingGithubService extends GithubService {
  private readonly hook: () => Promise<void>;

  constructor(
    config: ReturnType<typeof testAuthConfig>,
    fetchImpl: ReturnType<typeof createFakeGithub>['fetch'],
    hook: () => Promise<void>,
  ) {
    super(config, fetchImpl);
    this.hook = hook;
  }

  override async refresh(token: string) {
    const pair = await super.refresh(token);
    await this.hook();
    return pair;
  }
}

async function harness(seed: Seed) {
  const github = createFakeGithub();
  const config = testAuthConfig();
  const repo = new AuthRepository(db);
  const account = await repo.createAccount(PROFILE, 'owner');
  const credential = await repo.replaceCredential(account.id, {
    accessTokenEnc: encryptSecret('access-0', config.tokenKey),
    accessExpiresAt: new Date(NOW.getTime() + seed.accessInMs).toISOString(),
    refreshTokenEnc: encryptSecret('refresh-0', config.tokenKey),
    refreshExpiresAt: new Date(NOW.getTime() + seed.refreshInMs).toISOString(),
  });

  const race = seed.duringRefresh;
  const service =
    race === undefined
      ? new GithubService(config, github.fetch)
      : new RacingGithubService(config, github.fetch, () =>
          race({
            repo,
            credentialId: credential.id,
            tokenKey: config.tokenKey,
          }),
        );

  const tokens = new GhTokenService(repo, service, config.tokenKey, () => NOW);
  return {
    github,
    repo,
    account,
    config,
    tokens,
    sessions: new SessionService(repo),
  };
}

const HOUR = 60 * 60 * 1000;
const oauthCalls = (calls: string[]) =>
  calls.filter((call) => call === 'POST /login/oauth/access_token').length;

describe('GhTokenService', () => {
  it('hands back the stored token while it is comfortably valid', async () => {
    const { tokens, account, github } = await harness({
      accessInMs: HOUR,
      refreshInMs: 100 * 24 * HOUR,
    });

    expect(await tokens.getAccessToken(account.id)).toBe('access-0');
    expect(oauthCalls(github.calls)).toBe(0);
  });

  it('does not refresh a token that expires just outside the skew', async () => {
    const { tokens, account, github } = await harness({
      accessInMs: 61_000,
      refreshInMs: 100 * 24 * HOUR,
    });

    expect(await tokens.getAccessToken(account.id)).toBe('access-0');
    expect(oauthCalls(github.calls)).toBe(0);
  });

  it('refreshes a token that expires inside the skew, and stores the new pair', async () => {
    const { tokens, account, repo, github } = await harness({
      accessInMs: 30_000,
      refreshInMs: 100 * 24 * HOUR,
    });

    const token = await tokens.getAccessToken(account.id);

    expect(token).toBe('access-1');
    expect(oauthCalls(github.calls)).toBe(1);
    const credential = await repo.findCredential(account.id);
    // Rotation is a versioned write on the same row, not a new credential.
    expect(credential?.version).toBe(1);
    expect(credential?.access_token_enc).not.toContain('access-1');
    expect(
      new Date(credential?.access_expires_at as string).getTime(),
    ).toBeGreaterThan(NOW.getTime());
  });

  it('refreshes once for concurrent callers, since the refresh token is single-use', async () => {
    const { tokens, account, github } = await harness({
      accessInMs: 30_000,
      refreshInMs: 100 * 24 * HOUR,
    });

    const results = await Promise.all([
      tokens.getAccessToken(account.id),
      tokens.getAccessToken(account.id),
      tokens.getAccessToken(account.id),
    ]);

    expect(results).toEqual(['access-1', 'access-1', 'access-1']);
    expect(oauthCalls(github.calls)).toBe(1);
  });

  it('drops the credential and every session when the refresh token has expired', async () => {
    const { tokens, account, repo, sessions, github } = await harness({
      accessInMs: 30_000,
      refreshInMs: -1,
    });
    const session = await sessions.issue(account.id);

    expect(tokens.getAccessToken(account.id)).rejects.toThrow(
      GhCredentialExpiredError,
    );
    await Bun.sleep(0);

    expect(oauthCalls(github.calls)).toBe(0);
    expect(await repo.findCredential(account.id)).toBeNull();
    expect(await sessions.verify(session)).toBeNull();
  });

  it('drops the credential when GitHub itself refuses the refresh', async () => {
    const { tokens, account, repo, github } = await harness({
      accessInMs: 30_000,
      refreshInMs: 100 * 24 * HOUR,
    });
    // A revoked installation: the refresh token GitHub knows is not ours.
    github.validRefreshTokens = new Set(['someone-elses']);

    expect(tokens.getAccessToken(account.id)).rejects.toThrow(
      GhCredentialExpiredError,
    );
    await Bun.sleep(0);

    expect(await repo.findCredential(account.id)).toBeNull();
  });

  it('reports an account that has no credential at all', async () => {
    const { tokens, account, repo } = await harness({
      accessInMs: HOUR,
      refreshInMs: 100 * 24 * HOUR,
    });
    await repo.deleteCredential(account.id);

    expect(tokens.getAccessToken(account.id)).rejects.toThrow(
      GhCredentialExpiredError,
    );
  });

  it('yields to the writer that won, rather than overwriting with a dead pair', async () => {
    const { tokens, account } = await harness({
      accessInMs: 30_000,
      refreshInMs: 100 * 24 * HOUR,
      // Another process refreshed first; its pair is the live one and ours is
      // already dead by the time our write-back runs, so the loser must
      // reload rather than overwrite.
      duringRefresh: async ({ repo, credentialId, tokenKey }) => {
        await repo.rotateCredential(
          credentialId,
          {
            accessTokenEnc: encryptSecret('access-from-the-winner', tokenKey),
            accessExpiresAt: new Date(NOW.getTime() + HOUR).toISOString(),
            refreshTokenEnc: encryptSecret('refresh-from-the-winner', tokenKey),
            refreshExpiresAt: new Date(
              NOW.getTime() + 100 * 24 * HOUR,
            ).toISOString(),
          },
          0,
        );
      },
    });

    expect(await tokens.getAccessToken(account.id)).toBe(
      'access-from-the-winner',
    );
  });
});
