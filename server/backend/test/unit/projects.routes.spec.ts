import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { createApp } from '../../src/app.js';
import { createAuthModule } from '../../src/auth/auth.module.js';
import type { DatabaseService } from '../../src/database/database.service.js';
import { DesignDocsRepository } from '../../src/design-docs/design-docs.repository.js';
import { DesignDocsService } from '../../src/design-docs/design-docs.service.js';
import { GreetingService } from '../../src/greeting/greeting.service.js';
import { ProjectsRepository } from '../../src/projects/projects.repository.js';
import { ProjectsService } from '../../src/projects/projects.service.js';
import { RepoAccessService } from '../../src/projects/repo-access.service.js';
import { SearchService } from '../../src/ui/search/search.service.js';
import { createFakeGithub, testAuthConfig } from './github-fake.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';

// The /ui/projects surface end to end over the composed app: a signed-in
// session, the fake GitHub behind everything, and the refusal payloads the
// job stories demand.

const INSTALLATION = 7;
const REPOS = [
  { id: 1001, full_name: 'acme/api', private: true },
  { id: 1002, full_name: 'acme/web', private: false },
  { id: 1003, full_name: 'acme/lib', private: false },
];

let db: DatabaseService;

beforeAll(async () => {
  db = await sharedTestDatabase();
});

afterEach(resetGraph);

function harness() {
  const github = createFakeGithub({
    installations: [
      {
        id: INSTALLATION,
        account: { login: 'acme', type: 'Organization' },
        repository_selection: 'selected',
      },
    ],
    repositories: { [INSTALLATION]: [...REPOS] },
  });
  const module = createAuthModule(testAuthConfig(), db, github.fetch);
  if (module.mode !== 'github') throw new Error('expected github mode');
  const projectsRepository = new ProjectsRepository(db);
  const app = createApp({
    greetingService: new GreetingService(),
    searchService: new SearchService(),
    authModule: module,
    projectsService: new ProjectsService(projectsRepository),
    designDocsService: new DesignDocsService(new DesignDocsRepository(db)),
    repoAccess: new RepoAccessService(projectsRepository, module.ghApp),
  });
  return { github, module, app };
}

function cookiesFrom(res: Response): Map<string, string> {
  const jar = new Map<string, string>();
  for (const header of res.headers.getSetCookie()) {
    const [pair] = header.split(';');
    const index = (pair as string).indexOf('=');
    jar.set(
      (pair as string).slice(0, index),
      (pair as string).slice(index + 1),
    );
  }
  return jar;
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar]
    .filter(([, value]) => value !== '')
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/** Signs in through the fake and returns a ready-to-send cookie header. */
async function signedIn(app: ReturnType<typeof harness>['app']) {
  const start = await app.request('/auth/login');
  const jar = cookiesFrom(start);
  const state = new URL(
    start.headers.get('location') as string,
  ).searchParams.get('state') as string;
  const callback = await app.request(
    `/auth/callback?code=good-code&state=${encodeURIComponent(state)}`,
    { headers: { cookie: cookieHeader(jar) } },
  );
  expect(callback.status).toBe(302);
  const session = cookiesFrom(callback).get('noesis_session');
  if (session === undefined) throw new Error('no session cookie');
  return { cookie: `noesis_session=${session}` };
}

function jsonInit(cookie: string, method: string, body?: unknown) {
  return {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

async function createProject(
  app: ReturnType<typeof harness>['app'],
  cookie: string,
  name = 'Noesis',
  repositoryIds: string[] = ['1001', '1002'],
) {
  const res = await app.request(
    '/ui/projects',
    jsonInit(cookie, 'POST', {
      name,
      installationId: String(INSTALLATION),
      repositoryIds,
    }),
  );
  expect(res.status).toBe(201);
  const { project } = (await res.json()) as {
    project: { id: string; name: string };
  };
  return project;
}

describe('POST /ui/projects', () => {
  it('creates a project with its repositories in one sitting', async () => {
    const { app } = harness();
    const { cookie } = await signedIn(app);

    const project = await createProject(app, cookie);

    const list = await app.request('/ui/projects', { headers: { cookie } });
    const { projects } = (await list.json()) as { projects: unknown[] };
    expect(projects).toEqual([
      {
        id: project.id,
        name: 'Noesis',
        installationId: String(INSTALLATION),
        repositoryCount: 2,
        disconnectedCount: 0,
      },
    ]);
  });

  it('refuses a duplicate name and identifies the existing project', async () => {
    const { app } = harness();
    const { cookie } = await signedIn(app);
    const project = await createProject(app, cookie);

    const res = await app.request(
      '/ui/projects',
      jsonInit(cookie, 'POST', {
        name: 'Noesis',
        installationId: String(INSTALLATION),
        repositoryIds: ['1003'],
      }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'duplicate_name',
      existing: { id: project.id, name: 'Noesis' },
    });
  });

  it('refuses a repository owned by another project, naming the owner, and leaves no half-created shell', async () => {
    const { app } = harness();
    const { cookie } = await signedIn(app);
    const owner = await createProject(app, cookie, 'First', ['1001']);

    const res = await app.request(
      '/ui/projects',
      jsonInit(cookie, 'POST', {
        name: 'Second',
        installationId: String(INSTALLATION),
        repositoryIds: ['1003', '1001'],
      }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: 'repository_already_connected',
      repositoryId: '1001',
      owningProject: { id: owner.id, name: 'First' },
    });

    // Compensation: the refused create did not leave "Second" behind.
    const list = await app.request('/ui/projects', { headers: { cookie } });
    const { projects } = (await list.json()) as {
      projects: { name: string }[];
    };
    expect(projects.map((p) => p.name)).toEqual(['First']);
  });

  it('refuses repository ids the installation cannot reach', async () => {
    const { app } = harness();
    const { cookie } = await signedIn(app);

    const res = await app.request(
      '/ui/projects',
      jsonInit(cookie, 'POST', {
        name: 'Noesis',
        installationId: String(INSTALLATION),
        repositoryIds: ['9999'],
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'repository_not_reachable',
      repositoryId: '9999',
    });
  });

  it('refuses an installation the account has not linked', async () => {
    const { app } = harness();
    const { cookie } = await signedIn(app);

    const res = await app.request(
      '/ui/projects',
      jsonInit(cookie, 'POST', {
        name: 'Noesis',
        installationId: '999',
        repositoryIds: ['1001'],
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'unknown_installation' });
  });
});

describe('GET /ui/projects/:id', () => {
  it('serves the freshly checked detail', async () => {
    const { app, github } = harness();
    const { cookie } = await signedIn(app);
    const project = await createProject(app, cookie);
    // acme/web deselected on GitHub after the connect.
    github.repositories[INSTALLATION] = [REPOS[0] as (typeof REPOS)[number]];

    const res = await app.request(`/ui/projects/${project.id}`, {
      headers: { cookie },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      healthChecked: boolean;
      installationId: string;
      repositories: { id: string; status: string }[];
    };
    expect(body.healthChecked).toBe(true);
    expect(body.installationId).toBe(String(INSTALLATION));
    expect(body.repositories.find((r) => r.id === '1001')?.status).toBe(
      'connected',
    );
    expect(body.repositories.find((r) => r.id === '1002')?.status).toBe(
      'disconnected',
    );
  });

  it('404s an unknown project', async () => {
    const { app } = harness();
    const { cookie } = await signedIn(app);
    const res = await app.request('/ui/projects/missing', {
      headers: { cookie },
    });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /ui/projects/:id', () => {
  it('renames with the current version and refuses a stale one', async () => {
    const { app } = harness();
    const { cookie } = await signedIn(app);
    const project = await createProject(app, cookie);

    const ok = await app.request(
      `/ui/projects/${project.id}`,
      jsonInit(cookie, 'PATCH', { name: 'Renamed', version: 0 }),
    );
    expect(ok.status).toBe(200);

    const stale = await app.request(
      `/ui/projects/${project.id}`,
      jsonInit(cookie, 'PATCH', { name: 'Again', version: 0 }),
    );
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: 'version_conflict' });
  });
});

describe('DELETE /ui/projects/:id', () => {
  it('hard-deletes and frees the repositories', async () => {
    const { app } = harness();
    const { cookie } = await signedIn(app);
    const project = await createProject(app, cookie);

    const res = await app.request(`/ui/projects/${project.id}`, {
      method: 'DELETE',
      headers: { cookie },
    });
    expect(res.status).toBe(204);
    expect(
      (await app.request(`/ui/projects/${project.id}`, { headers: { cookie } }))
        .status,
    ).toBe(404);

    // The repositories are attachable again.
    await createProject(app, cookie, 'Fresh', ['1001']);
  });
});

describe('repository attach/detach', () => {
  it('attaches, detaches, and refuses to detach the last repository', async () => {
    const { app } = harness();
    const { cookie } = await signedIn(app);
    const project = await createProject(app, cookie, 'Noesis', ['1001']);

    const attach = await app.request(
      `/ui/projects/${project.id}/repositories`,
      jsonInit(cookie, 'POST', { repositoryId: '1002' }),
    );
    expect(attach.status).toBe(201);

    const detach = await app.request(
      `/ui/projects/${project.id}/repositories/1002`,
      { method: 'DELETE', headers: { cookie } },
    );
    expect(detach.status).toBe(204);

    const last = await app.request(
      `/ui/projects/${project.id}/repositories/1001`,
      { method: 'DELETE', headers: { cookie } },
    );
    expect(last.status).toBe(409);
    expect(await last.json()).toEqual({ error: 'last_repository' });
  });
});

describe('GET /ui/github/installations/:id/repositories', () => {
  it('annotates repositories already owned by a project', async () => {
    const { app } = harness();
    const { cookie } = await signedIn(app);
    const project = await createProject(app, cookie, 'Noesis', ['1001']);

    const res = await app.request(
      `/ui/github/installations/${INSTALLATION}/repositories`,
      { headers: { cookie } },
    );
    expect(res.status).toBe(200);
    const { repositories } = (await res.json()) as {
      repositories: { id: string; owningProject: { id: string } | null }[];
    };
    expect(repositories).toHaveLength(3);
    expect(repositories.find((r) => r.id === '1001')?.owningProject?.id).toBe(
      project.id,
    );
    expect(repositories.find((r) => r.id === '1002')?.owningProject).toBeNull();
  });

  it('404s an installation the account has not linked', async () => {
    const { app } = harness();
    const { cookie } = await signedIn(app);
    const res = await app.request('/ui/github/installations/999/repositories', {
      headers: { cookie },
    });
    expect(res.status).toBe(404);
  });
});

describe('install returnTo (projects.md §2)', () => {
  async function installRoundTrip(returnTo: string | undefined) {
    const { app } = harness();
    const { cookie } = await signedIn(app);
    const query =
      returnTo === undefined ? '' : `?returnTo=${encodeURIComponent(returnTo)}`;
    const start = await app.request(`/auth/install${query}`, {
      headers: { cookie },
    });
    expect(start.status).toBe(302);
    const jar = cookiesFrom(start);
    const state = new URL(
      start.headers.get('location') as string,
    ).searchParams.get('state') as string;

    const callback = await app.request(
      `/auth/install/callback?state=${encodeURIComponent(state)}&installation_id=${INSTALLATION}&setup_action=install`,
      { headers: { cookie: `${cookie}; ${cookieHeader(jar)}` } },
    );
    expect(callback.status).toBe(302);
    return callback.headers.get('location');
  }

  it('lands back where the connect flow left off', async () => {
    expect(await installRoundTrip('/projects/new?step=2')).toBe(
      '/projects/new?step=2&install=connected',
    );
  });

  it('falls back to /settings without a returnTo', async () => {
    expect(await installRoundTrip(undefined)).toBe(
      '/settings?install=connected',
    );
  });

  it('drops absolute and protocol-relative targets', async () => {
    expect(await installRoundTrip('https://evil.example/phish')).toBe(
      '/settings?install=connected',
    );
    expect(await installRoundTrip('//evil.example/phish')).toBe(
      '/settings?install=connected',
    );
  });
});

describe('disabled auth mode', () => {
  it('refuses project creation with auth_disabled (resolved question)', async () => {
    const projectsRepository = new ProjectsRepository(db);
    const app = createApp({
      greetingService: new GreetingService(),
      searchService: new SearchService(),
      authModule: { mode: 'disabled' },
      projectsService: new ProjectsService(projectsRepository),
      designDocsService: new DesignDocsService(new DesignDocsRepository(db)),
      repoAccess: null,
    });

    const res = await app.request('/ui/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Noesis',
        installationId: '7',
        repositoryIds: ['1001'],
      }),
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'auth_disabled' });

    // Reads still answer.
    const list = await app.request('/ui/projects');
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual({ projects: [] });
  });
});
