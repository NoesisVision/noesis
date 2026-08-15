import type {
  AccountRow,
  AuthRepository,
  SessionRow,
} from './auth.repository.js';
import { hashToken, randomToken } from './crypto.js';

/** 30 days, matching the cookie's `Max-Age`. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * How stale a session may get before use re-stamps it. Without this every
 * request would write; with it, an active session is extended at most once a
 * day and still never expires under an active user.
 */
export const SESSION_SLIDING_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface AuthenticatedSession {
  account: AccountRow;
  session: SessionRow;
}

/**
 * Opaque server-side sessions. The cookie carries 32 random bytes; the graph
 * stores only their SHA-256, so a database read cannot impersonate anyone and
 * the digest doubles as the row's primary key.
 */
export class SessionService {
  private readonly repo: AuthRepository;
  private readonly now: () => Date;

  // The clock is injectable so expiry and sliding-renewal are testable without
  // sleeping through a day.
  constructor(repo: AuthRepository, now: () => Date = () => new Date()) {
    this.repo = repo;
    this.now = now;
  }

  /** Returns the raw token — the only moment it exists outside the browser. */
  async issue(accountId: string): Promise<string> {
    const token = randomToken();
    const expiresAt = new Date(this.now().getTime() + SESSION_TTL_MS);
    await this.repo.createSession(
      accountId,
      hashToken(token),
      expiresAt.toISOString(),
    );
    return token;
  }

  async verify(token: string): Promise<AuthenticatedSession | null> {
    const tokenHash = hashToken(token);
    const found = await this.repo.findSession(tokenHash);
    if (found === null) return null;

    const now = this.now();
    if (new Date(found.session.expires_at).getTime() <= now.getTime()) {
      // Expired sessions are removed on the way past rather than by a sweeper:
      // the row is only ever reached through its own token.
      await this.repo.deleteSession(tokenHash);
      return null;
    }

    const remaining =
      new Date(found.session.expires_at).getTime() - now.getTime();
    if (remaining < SESSION_TTL_MS - SESSION_SLIDING_INTERVAL_MS) {
      const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
      await this.repo.extendSession(tokenHash, expiresAt);
      return { ...found, session: { ...found.session, expires_at: expiresAt } };
    }
    return found;
  }

  /** Sign-in rotates the id: a token captured before login is worthless after it. */
  async rotate(
    previousToken: string | undefined,
    accountId: string,
  ): Promise<string> {
    if (previousToken !== undefined) {
      await this.repo.deleteSession(hashToken(previousToken));
    }
    return this.issue(accountId);
  }

  async revoke(token: string): Promise<void> {
    await this.repo.deleteSession(hashToken(token));
  }

  async revokeAllFor(accountId: string): Promise<void> {
    await this.repo.deleteSessionsForAccount(accountId);
  }
}
