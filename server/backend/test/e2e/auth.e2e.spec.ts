import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { createApp } from '../../src/app.js';
import { createAuthModule } from '../../src/auth/auth.module.js';
import { AuthRepository } from '../../src/auth/auth.repository.js';
import {
  createFakeGithub,
  testAuthConfig,
} from '../../src/auth/github-fake.js';
import type { DatabaseService } from '../../src/database/database.service.js';
import { DesignDocsRepository } from '../../src/design-docs/design-docs.repository.js';
import { DesignDocsService } from '../../src/design-docs/design-docs.service.js';
import { GreetingService } from '../../src/greeting/greeting.service.js';
import { InboxRepository } from '../../src/inbox/inbox.repository.js';
import { InboxService } from '../../src/inbox/inbox.service.js';
import { ProjectsRepository } from '../../src/projects/projects.repository.js';
import { ProjectsService } from '../../src/projects/projects.service.js';
import { RepoAccessService } from '../../src/projects/repo-access.service.js';
import { SearchService } from '../../src/ui/search/search.service.js';
import { resetGraph, sharedTestDatabase } from '../unit/test-db.js';

// The guarded surface over the composed app: what an anonymous caller gets,
// what a session gets, and what stops working after logout.

let db: DatabaseService;

const PROFILE = {
  ghUserId: 4711,
  login: 'octocat',
  name: 'The Octocat',
  avatarUrl: 'https://avatars.example/4711',
  email: 'octocat@example.com',
};

beforeAll(async () => {
  db = await sharedTestDatabase();
});

afterEach(resetGraph);

function harness() {
  const github = createFakeGithub();
  const module = createAuthModule(testAuthConfig(), db, github.fetch);
  if (module.mode !== 'github') throw new Error('expected github mode');
  const projectsRepository = new ProjectsRepository(db);
  return {
    module,
    repo: new AuthRepository(db),
    app: createApp({
      greetingService: new GreetingService(),
      searchService: new SearchService(),
      authModule: module,
      projectsService: new ProjectsService(projectsRepository),
      designDocsService: new DesignDocsService(new DesignDocsRepository(db)),
      inboxService: new InboxService(new InboxRepository(db)),
      repoAccess: new RepoAccessService(projectsRepository, module.ghApp),
    }),
  };
}

async function invitesOf(res: Response): Promise<unknown[]> {
  return ((await res.json()) as { invites: unknown[] }).invites;
}

function withSession(token: string) {
  return { headers: { cookie: `noesis_session=${token}` } };
}

describe('the guarded ui surface (e2e)', () => {
  it('answers 401 on every /ui endpoint without a session', async () => {
    const { app } = harness();

    for (const path of [
      '/ui/me',
      '/ui/hello',
      '/ui/search?q=x',
      '/ui/invites',
    ]) {
      const res = await app.request(path);
      expect(res.status).toBe(401);
    }
  });

  it('answers 401 for a session cookie that names nothing', async () => {
    const { app } = harness();
    const res = await app.request('/ui/me', withSession('made-up'));
    expect(res.status).toBe(401);
  });

  it('lets a seeded session through to /ui/hello and /ui/me', async () => {
    const { app, module, repo } = harness();
    const account = await repo.createAccount(PROFILE, 'owner');
    const token = await module.sessions.issue(account.id);

    const hello = await app.request('/ui/hello', withSession(token));
    expect(hello.status).toBe(200);
    expect(await hello.text()).toBe('Hello World!');

    const me = await app.request('/ui/me', withSession(token));
    expect(me.status).toBe(200);
    // Zero installations is a normal signed-in state, not an error.
    expect(await me.json()).toEqual({
      account: {
        id: account.id,
        login: 'octocat',
        name: 'The Octocat',
        avatarUrl: 'https://avatars.example/4711',
        role: 'owner',
      },
      installations: [],
      authMode: 'github',
    });
  });

  it('stops answering after logout', async () => {
    const { app, module, repo } = harness();
    const account = await repo.createAccount(PROFILE, 'owner');
    const token = await module.sessions.issue(account.id);

    const logout = await app.request('/auth/logout', {
      method: 'POST',
      ...withSession(token),
    });
    expect(logout.status).toBe(204);

    expect((await app.request('/ui/me', withSession(token))).status).toBe(401);
  });

  it('leaves the unguarded surfaces alone', async () => {
    const { app } = harness();

    expect((await app.request('/internal/health')).status).toBe(200);
    expect((await app.request('/api/hello')).status).toBe(200);
    // /auth is the sign-in entry point, so it must answer without a session.
    expect((await app.request('/auth/login')).status).toBe(302);
  });
});

describe('/ui/invites (e2e)', () => {
  async function signedIn(role: 'owner' | 'member') {
    const h = harness();
    const account = await h.repo.createAccount(
      { ...PROFILE, ghUserId: role === 'owner' ? 1 : 2, login: role },
      role,
    );
    return { ...h, account, token: await h.module.sessions.issue(account.id) };
  }

  it('lets an owner list, create and revoke invites', async () => {
    const { app, token } = await signedIn('owner');

    const created = await app.request('/ui/invites', {
      method: 'POST',
      headers: {
        cookie: `noesis_session=${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ghLogin: 'newcomer' }),
    });
    expect(created.status).toBe(201);
    const { invite } = (await created.json()) as {
      invite: { id: string; ghLogin: string; acceptedAt: string | null };
    };
    expect(invite.ghLogin).toBe('newcomer');
    expect(invite.acceptedAt).toBeNull();

    const listed = await app.request('/ui/invites', withSession(token));
    expect(listed.status).toBe(200);
    expect(await invitesOf(listed)).toHaveLength(1);

    const revoked = await app.request(`/ui/invites/${invite.id}`, {
      method: 'DELETE',
      ...withSession(token),
    });
    expect(revoked.status).toBe(204);
    expect(
      await invitesOf(await app.request('/ui/invites', withSession(token))),
    ).toHaveLength(0);
  });

  it('rejects a malformed GitHub login with a 400', async () => {
    const { app, token } = await signedIn('owner');

    const res = await app.request('/ui/invites', {
      method: 'POST',
      headers: {
        cookie: `noesis_session=${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ghLogin: 'not a login!' }),
    });

    expect(res.status).toBe(400);
  });

  it('answers 403 to a member — authenticated, but not an owner', async () => {
    const { app, token } = await signedIn('member');

    const listed = await app.request('/ui/invites', withSession(token));
    expect(listed.status).toBe(403);

    const created = await app.request('/ui/invites', {
      method: 'POST',
      headers: {
        cookie: `noesis_session=${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ghLogin: 'newcomer' }),
    });
    expect(created.status).toBe(403);
  });
});

describe('NOESIS_AUTH_MODE=disabled (e2e)', () => {
  it('runs every request as a fixed local owner', async () => {
    const app = createApp({
      greetingService: new GreetingService(),
      searchService: new SearchService(),
      authModule: { mode: 'disabled' },
      projectsService: new ProjectsService(new ProjectsRepository(db)),
      designDocsService: new DesignDocsService(new DesignDocsRepository(db)),
      inboxService: new InboxService(new InboxRepository(db)),
      repoAccess: null,
    });

    const me = await app.request('/ui/me');
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({
      account: {
        id: 'local-owner',
        login: 'local',
        name: 'Local development',
        avatarUrl: '',
        role: 'owner',
      },
      installations: [],
      authMode: 'disabled',
    });
    expect((await app.request('/ui/hello')).status).toBe(200);
  });
});
