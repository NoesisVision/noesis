import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { GhAppService } from '../../src/auth/gh-app.service.js';
import type { FetchLike } from '../../src/auth/github.service.js';
import type { DatabaseService } from '../../src/database/database.service.js';
import { ProjectsRepository } from '../../src/projects/projects.repository.js';
import { RepoAccessService } from '../../src/projects/repo-access.service.js';
import {
  createFakeGithub,
  type FakeGithub,
  testAuthConfig,
} from './github-fake.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';

// The access-check transitions (projects.md §3): connected ↔ disconnected,
// installation gone, GitHub down. The fake's repository sets are mutated
// between checks to simulate grants and revocations on GitHub's side.

const INSTALLATION = 7;

let db: DatabaseService;
let repo: ProjectsRepository;

async function seedProject(
  fake: FakeGithub,
  repoIds: readonly number[],
): Promise<string> {
  await db.query(
    `CREATE (:GhInstallation {id: $id, account_login: 'acme',
       account_type: 'Organization', repository_selection: 'selected',
       created_at: $now})`,
    { id: String(INSTALLATION), now: new Date().toISOString() },
  );
  const project = await repo.create('Noesis');
  if (project === null) throw new Error('fixture: name taken');
  await repo.setInstallation(project.id, String(INSTALLATION));
  for (const id of repoIds) {
    const source = (fake.repositories[INSTALLATION] ?? []).find(
      (r) => r.id === id,
    );
    const attached = await repo.attachRepository(project.id, {
      id: String(id),
      fullName: source?.full_name ?? `acme/${id}`,
      private: source?.private ?? false,
    });
    if (attached === null) throw new Error(`fixture: attach ${id} refused`);
  }
  return project.id;
}

function service(fetchImpl: FetchLike): RepoAccessService {
  return new RepoAccessService(
    repo,
    new GhAppService(testAuthConfig(), fetchImpl),
  );
}

describe('RepoAccessService', () => {
  beforeAll(async () => {
    db = await sharedTestDatabase();
    repo = new ProjectsRepository(db);
  });

  afterEach(async () => {
    await resetGraph();
  });

  it('keeps reachable repositories connected and refreshes their metadata', async () => {
    const fake = createFakeGithub({
      repositories: {
        [INSTALLATION]: [{ id: 1001, full_name: 'acme/api', private: true }],
      },
    });
    const projectId = await seedProject(fake, [1001]);
    // Renamed on GitHub since the attach.
    fake.repositories[INSTALLATION] = [
      { id: 1001, full_name: 'acme/api-v2', private: false },
    ];

    const result = await service(fake.fetch).checkProject(projectId);
    expect(result.healthChecked).toBe(true);
    expect(result.repositories[0]?.status).toBe('connected');
    expect(result.repositories[0]?.full_name).toBe('acme/api-v2');
    expect(result.repositories[0]?.private).toBe(false);
  });

  it('disconnects repositories the App lost, and reconnects on re-grant', async () => {
    const fake = createFakeGithub({
      repositories: {
        [INSTALLATION]: [
          { id: 1001, full_name: 'acme/api', private: true },
          { id: 1002, full_name: 'acme/web', private: false },
        ],
      },
    });
    const projectId = await seedProject(fake, [1001, 1002]);
    const svc = service(fake.fetch);

    // acme/web deselected on GitHub.
    fake.repositories[INSTALLATION] = [
      { id: 1001, full_name: 'acme/api', private: true },
    ];
    let result = await svc.checkProject(projectId);
    const web = result.repositories.find((r) => r.id === '1002');
    expect(web?.status).toBe('disconnected');
    expect(result.repositories.find((r) => r.id === '1001')?.status).toBe(
      'connected',
    );

    // Re-granted: back to connected, same node, history intact.
    fake.repositories[INSTALLATION] = [
      { id: 1001, full_name: 'acme/api', private: true },
      { id: 1002, full_name: 'acme/web', private: false },
    ];
    result = await svc.checkProject(projectId);
    expect(result.repositories.find((r) => r.id === '1002')?.status).toBe(
      'connected',
    );
  });

  it('disconnects everything when the installation itself is gone', async () => {
    const fake = createFakeGithub({
      repositories: {
        [INSTALLATION]: [
          { id: 1001, full_name: 'acme/api', private: true },
          { id: 1002, full_name: 'acme/web', private: false },
        ],
      },
    });
    const projectId = await seedProject(fake, [1001, 1002]);
    fake.goneInstallations.add(INSTALLATION);

    const result = await service(fake.fetch).checkProject(projectId);
    expect(result.healthChecked).toBe(true);
    expect(result.repositories.every((r) => r.status === 'disconnected')).toBe(
      true,
    );
  });

  it('serves stored state unchanged when GitHub is unreachable', async () => {
    const fake = createFakeGithub({
      repositories: {
        [INSTALLATION]: [{ id: 1001, full_name: 'acme/api', private: true }],
      },
    });
    const projectId = await seedProject(fake, [1001]);
    const down = (() =>
      Promise.reject(new TypeError('fetch failed'))) as unknown as FetchLike;

    const result = await service(down).checkProject(projectId);
    expect(result.healthChecked).toBe(false);
    expect(result.repositories[0]?.status).toBe('connected');
  });
});
