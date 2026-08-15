import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { AuthRepository } from '../../src/auth/auth.repository.js';
import { hashToken } from '../../src/auth/crypto.js';
import {
  SESSION_SLIDING_INTERVAL_MS,
  SESSION_TTL_MS,
  SessionService,
} from '../../src/auth/session.service.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';

let repo: AuthRepository;

const PROFILE = {
  ghUserId: 1,
  login: 'octocat',
  name: 'The Octocat',
  avatarUrl: '',
  email: '',
};

beforeAll(async () => {
  repo = new AuthRepository(await sharedTestDatabase());
});

afterEach(resetGraph);

// A movable clock, so expiry and sliding renewal are asserted without sleeping.
function fixedClock(start: Date) {
  let current = start;
  return {
    now: () => current,
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

describe('SessionService', () => {
  it('issues a token that verifies to its account', async () => {
    const account = await repo.createAccount(PROFILE, 'owner');
    const sessions = new SessionService(repo);

    const token = await sessions.issue(account.id);
    const verified = await sessions.verify(token);

    expect(verified?.account.id).toBe(account.id);
    expect(verified?.account.role).toBe('owner');
  });

  it('stores only the hash of the token, never the token', async () => {
    const account = await repo.createAccount(PROFILE, 'owner');
    const sessions = new SessionService(repo);

    const token = await sessions.issue(account.id);

    // The stored id is the digest: a database read cannot be replayed as a cookie.
    expect(await repo.findSession(hashToken(token))).not.toBeNull();
    expect(await repo.findSession(token)).toBeNull();
  });

  it('rejects an unknown token', async () => {
    const sessions = new SessionService(repo);
    expect(await sessions.verify('not-a-session')).toBeNull();
  });

  it('expires a session and removes the row on the way past', async () => {
    const account = await repo.createAccount(PROFILE, 'owner');
    const clock = fixedClock(new Date('2026-08-13T10:00:00.000Z'));
    const sessions = new SessionService(repo, clock.now);
    const token = await sessions.issue(account.id);

    clock.advance(SESSION_TTL_MS + 1);

    expect(await sessions.verify(token)).toBeNull();
    expect(await repo.findSession(hashToken(token))).toBeNull();
  });

  it('leaves a fresh session alone rather than writing on every request', async () => {
    const account = await repo.createAccount(PROFILE, 'owner');
    const clock = fixedClock(new Date('2026-08-13T10:00:00.000Z'));
    const sessions = new SessionService(repo, clock.now);
    const token = await sessions.issue(account.id);
    const before = (await repo.findSession(hashToken(token)))?.session
      .expires_at;

    clock.advance(SESSION_SLIDING_INTERVAL_MS / 2);
    await sessions.verify(token);

    expect((await repo.findSession(hashToken(token)))?.session.expires_at).toBe(
      before as string,
    );
  });

  it('re-stamps a session that has aged past the sliding interval', async () => {
    const account = await repo.createAccount(PROFILE, 'owner');
    const clock = fixedClock(new Date('2026-08-13T10:00:00.000Z'));
    const sessions = new SessionService(repo, clock.now);
    const token = await sessions.issue(account.id);
    const before = (await repo.findSession(hashToken(token)))?.session
      .expires_at as string;

    clock.advance(SESSION_SLIDING_INTERVAL_MS + 1000);
    const verified = await sessions.verify(token);

    expect(verified).not.toBeNull();
    expect(new Date(verified?.session.expires_at as string).getTime()).toBe(
      clock.now().getTime() + SESSION_TTL_MS,
    );
    expect(verified?.session.expires_at).not.toBe(before);
  });

  it('rotates the id on login, killing the previous token', async () => {
    const account = await repo.createAccount(PROFILE, 'owner');
    const sessions = new SessionService(repo);
    const first = await sessions.issue(account.id);

    const second = await sessions.rotate(first, account.id);

    expect(second).not.toBe(first);
    expect(await sessions.verify(first)).toBeNull();
    expect((await sessions.verify(second))?.account.id).toBe(account.id);
  });

  it('revokes a single session and, separately, all of an account', async () => {
    const account = await repo.createAccount(PROFILE, 'owner');
    const sessions = new SessionService(repo);
    const laptop = await sessions.issue(account.id);
    const phone = await sessions.issue(account.id);

    await sessions.revoke(laptop);
    expect(await sessions.verify(laptop)).toBeNull();
    expect(await sessions.verify(phone)).not.toBeNull();

    await sessions.revokeAllFor(account.id);
    expect(await sessions.verify(phone)).toBeNull();
  });
});
