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
import { createFakeGithub, testAuthConfig } from '../unit/github-fake.js';
import { resetGraph, sharedTestDatabase } from '../unit/test-db.js';

// The whole elicited journey in one pass: sign in, create a project with
// repositories, lose access on GitHub and see it, detach, delete. The
// per-refusal details live in test/unit/projects.routes.spec.ts.

const INSTALLATION = 7;

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
    repositories: {
      [INSTALLATION]: [
        { id: 1001, full_name: 'acme/api', private: true },
        { id: 1002, full_name: 'acme/web', private: false },
      ],
    },
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
  return { github, app };
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

async function signedIn(app: ReturnType<typeof harness>['app']) {
  const start = await app.request('/auth/login');
  const state = new URL(
    start.headers.get('location') as string,
  ).searchParams.get('state') as string;
  const cookie = [...cookiesFrom(start)]
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  const callback = await app.request(
    `/auth/callback?code=good-code&state=${encodeURIComponent(state)}`,
    { headers: { cookie } },
  );
  const session = cookiesFrom(callback).get('noesis_session');
  if (session === undefined) throw new Error('no session cookie');
  return `noesis_session=${session}`;
}

describe('Projects (e2e)', () => {
  it('create → health after GitHub-side revocation → detach → delete', async () => {
    const { github, app } = harness();
    const cookie = await signedIn(app);

    // Create with both repositories.
    const created = await app.request('/ui/projects', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Noesis',
        installationId: String(INSTALLATION),
        repositoryIds: ['1001', '1002'],
      }),
    });
    expect(created.status).toBe(201);
    const { project } = (await created.json()) as {
      project: { id: string };
    };

    // acme/web loses App access on GitHub; the detail view sees it.
    github.repositories[INSTALLATION] = [
      { id: 1001, full_name: 'acme/api', private: true },
    ];
    const detail = await app.request(`/ui/projects/${project.id}`, {
      headers: { cookie },
    });
    const body = (await detail.json()) as {
      healthChecked: boolean;
      repositories: { id: string; status: string }[];
    };
    expect(body.healthChecked).toBe(true);
    expect(body.repositories.find((r) => r.id === '1002')?.status).toBe(
      'disconnected',
    );

    // Detach the dead repository; the survivor is protected as the last one.
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

    // Delete ends the story; the workspace is empty again.
    const remove = await app.request(`/ui/projects/${project.id}`, {
      method: 'DELETE',
      headers: { cookie },
    });
    expect(remove.status).toBe(204);
    const list = await app.request('/ui/projects', { headers: { cookie } });
    expect(await list.json()).toEqual({ projects: [] });
  });
});
