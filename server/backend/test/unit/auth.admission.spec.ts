import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { AuthRepository } from '../../src/auth/auth.repository.js';
import { AuthService } from '../../src/auth/auth.service.js';
import { GithubService } from '../../src/auth/github.service.js';
import {
  createFakeGithub,
  testAuthConfig,
} from '../../src/auth/github-fake.js';
import { SessionService } from '../../src/auth/session.service.js';
import type { DatabaseService } from '../../src/database/database.service.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';

// §6's admission rule is the callback's first branch, so it is tested through
// the service that owns it rather than through HTTP.

let db: DatabaseService;

beforeAll(async () => {
  db = await sharedTestDatabase();
});

afterEach(resetGraph);

function harness(options: Parameters<typeof createFakeGithub>[0] = {}) {
  const github = createFakeGithub(options);
  const config = testAuthConfig();
  const repo = new AuthRepository(db);
  const sessions = new SessionService(repo);
  const service = new AuthService(
    repo,
    sessions,
    new GithubService(config, github.fetch),
    config.tokenKey,
  );
  return { github, repo, sessions, service };
}

describe('admission: who may sign in', () => {
  it('makes the very first login the owner of the instance', async () => {
    const { service, repo } = harness();

    const result = await service.signInWithCode('good-code');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.account.role).toBe('owner');
    expect(result.account.login).toBe('octocat');
    expect(await repo.countAccounts()).toBe(1);
  });

  it('signs an existing account back in and refreshes its cached profile', async () => {
    const { service, repo, github } = harness();
    const first = await service.signInWithCode('good-code');
    expect(first.ok).toBe(true);

    github.profile = { ...github.profile, name: 'Renamed Octocat' };
    github.validCodes.add('second-code');
    const second = await service.signInWithCode('second-code');

    expect(second.ok).toBe(true);
    if (!second.ok || !first.ok) return;
    expect(second.account.id).toBe(first.account.id);
    expect(second.account.name).toBe('Renamed Octocat');
    expect(await repo.countAccounts()).toBe(1);
  });

  it('rejects a second, uninvited login and writes nothing', async () => {
    const { service, repo } = harness();
    await service.signInWithCode('good-code');

    const { service: other, github } = harness({
      profile: { id: 99, login: 'stranger' },
    });
    github.validCodes.add('stranger-code');
    const result = await other.signInWithCode('stranger-code');

    expect(result).toEqual({
      ok: false,
      reason: 'not_invited',
      login: 'stranger',
    });
    expect(await repo.countAccounts()).toBe(1);
  });

  it('admits an invited login as a member and consumes the invite', async () => {
    const { service, repo } = harness();
    const owner = await service.signInWithCode('good-code');
    expect(owner.ok).toBe(true);
    if (!owner.ok) return;
    await service.invite('newcomer', owner.account);

    const { service: joining, github } = harness({
      profile: { id: 77, login: 'newcomer' },
    });
    github.validCodes.add('newcomer-code');
    const result = await joining.signInWithCode('newcomer-code');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.account.role).toBe('member');
    expect(await repo.countAccounts()).toBe(2);
    const invites = await service.listInvites();
    expect(invites[0]?.acceptedAt).not.toBeNull();
  });

  it('does not admit twice on an already-accepted invite', async () => {
    const { service } = harness();
    const owner = await service.signInWithCode('good-code');
    if (!owner.ok) return;
    await service.invite('newcomer', owner.account);

    const first = harness({ profile: { id: 77, login: 'newcomer' } });
    first.github.validCodes.add('c1');
    expect((await first.service.signInWithCode('c1')).ok).toBe(true);

    // A different GitHub account with the same login can never happen, but a
    // *new* account claiming a consumed invite must not get in.
    const second = harness({ profile: { id: 78, login: 'newcomer' } });
    second.github.validCodes.add('c2');
    const result = await second.service.signInWithCode('c2');

    expect(result.ok).toBe(false);
    expect(await first.repo.countAccounts()).toBe(2);
  });

  it('lets only one of two simultaneous first logins claim ownership', async () => {
    const alice = harness({ profile: { id: 1, login: 'alice' } });
    const bob = harness({ profile: { id: 2, login: 'bob' } });
    alice.github.validCodes.add('a');
    bob.github.validCodes.add('b');

    const [first, second] = await Promise.all([
      alice.service.signInWithCode('a'),
      bob.service.signInWithCode('b'),
    ]);

    const winners = [first, second].filter((r) => r.ok);
    expect(winners).toHaveLength(1);
    expect(winners[0]?.ok === true && winners[0].account.role).toBe('owner');
    expect(await alice.repo.countAccounts()).toBe(1);
  });

  it('stores the credential encrypted, not in the clear', async () => {
    const { service, repo, github } = harness();
    const result = await service.signInWithCode('good-code');
    if (!result.ok) return;

    const credential = await repo.findCredential(result.account.id);
    const issued = github.issuedAccessTokens[0] as string;
    expect(credential).not.toBeNull();
    expect(credential?.access_token_enc).not.toContain(issued);
    expect(credential?.refresh_token_enc).not.toContain('refresh-');
  });

  it('records the installations the user can see', async () => {
    const { service } = harness({
      installations: [
        {
          id: 42,
          account: { login: 'acme', type: 'Organization' },
          repository_selection: 'selected',
        },
      ],
    });

    const result = await service.signInWithCode('good-code');
    if (!result.ok) return;
    const installations = await service.listInstallations(result.account.id);

    expect(installations).toEqual([
      {
        id: '42',
        accountLogin: 'acme',
        accountType: 'Organization',
        repositorySelection: 'selected',
        manageUrl:
          'https://github.com/organizations/acme/settings/installations/42',
      },
    ]);
  });
});

describe('invites', () => {
  it('is idempotent for a login that already has a pending invite', async () => {
    const { service } = harness();
    const owner = await service.signInWithCode('good-code');
    if (!owner.ok) return;

    const first = await service.invite('newcomer', owner.account);
    const second = await service.invite('newcomer', owner.account);

    expect(second.id).toBe(first.id);
    expect(await service.listInvites()).toHaveLength(1);
  });

  it('revokes a pending invite, and reports an unknown id', async () => {
    const { service } = harness();
    const owner = await service.signInWithCode('good-code');
    if (!owner.ok) return;
    const invite = await service.invite('newcomer', owner.account);

    expect(await service.revokeInvite(invite.id)).toBe(true);
    expect(await service.listInvites()).toHaveLength(0);
    expect(await service.revokeInvite(invite.id)).toBe(false);
  });
});
