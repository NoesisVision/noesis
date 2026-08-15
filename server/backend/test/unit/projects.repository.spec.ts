import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import type { DatabaseService } from '../../src/database/database.service.js';
import {
  ProjectsRepository,
  type RepositoryInput,
} from '../../src/projects/projects.repository.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';

// The invariant guards (projects.md §1): every refusal is a conditional write
// coming back empty, never a read-then-write race window.

let db: DatabaseService;
let repo: ProjectsRepository;

const REPO_A: RepositoryInput = {
  id: '1001',
  fullName: 'acme/api',
  private: true,
};
const REPO_B: RepositoryInput = {
  id: '1002',
  fullName: 'acme/web',
  private: false,
};

async function installation(id = 'inst-1'): Promise<string> {
  await db.query(
    `CREATE (:GhInstallation {id: $id, account_login: 'acme',
       account_type: 'Organization', repository_selection: 'selected',
       created_at: $now})`,
    { id, now: new Date().toISOString() },
  );
  return id;
}

async function projectWith(
  name: string,
  repos: readonly RepositoryInput[],
  installationId = 'inst-1',
): Promise<string> {
  const project = await repo.create(name);
  if (project === null) throw new Error(`fixture: name "${name}" taken`);
  await repo.setInstallation(project.id, installationId);
  for (const r of repos) {
    const attached = await repo.attachRepository(project.id, r);
    if (attached === null) throw new Error(`fixture: attach ${r.id} refused`);
  }
  return project.id;
}

describe('ProjectsRepository (guarded writes)', () => {
  beforeAll(async () => {
    db = await sharedTestDatabase();
    repo = new ProjectsRepository(db);
  });

  afterEach(async () => {
    await resetGraph();
  });

  describe('create', () => {
    it('refuses a duplicate name, and the holder is retrievable', async () => {
      const first = await repo.create('Noesis');
      expect(first).not.toBeNull();

      expect(await repo.create('Noesis')).toBeNull();
      expect((await repo.findByName('Noesis'))?.id).toBe(first?.id ?? '');
    });
  });

  describe('attachRepository', () => {
    it('attaches as connected, wired to the project installation', async () => {
      await installation();
      const projectId = await projectWith('Noesis', [REPO_A]);

      const repos = await repo.listRepositories(projectId);
      expect(repos).toHaveLength(1);
      expect(repos[0]?.id).toBe(REPO_A.id);
      expect(repos[0]?.full_name).toBe('acme/api');
      expect(repos[0]?.private).toBe(true);
      expect(repos[0]?.status).toBe('connected');
    });

    it('refuses a repository owned by another project and names the owner', async () => {
      await installation();
      const ownerId = await projectWith('First', [REPO_A]);
      const otherId = await projectWith('Second', [REPO_B]);

      expect(await repo.attachRepository(otherId, REPO_A)).toBeNull();
      expect((await repo.findOwningProject(REPO_A.id))?.id).toBe(ownerId);
      // The refused attach left nothing behind.
      expect(await repo.listRepositories(otherId)).toHaveLength(1);
    });

    it('refuses when the project has no installation bound', async () => {
      const project = await repo.create('Unbound');
      expect(project).not.toBeNull();
      expect(await repo.attachRepository(project?.id ?? '', REPO_A)).toBeNull();
    });
  });

  describe('detachRepository', () => {
    it('detaches and deletes the repository node', async () => {
      await installation();
      const projectId = await projectWith('Noesis', [REPO_A, REPO_B]);

      expect(await repo.detachRepository(projectId, REPO_A.id)).toBe(true);
      expect(await repo.listRepositories(projectId)).toHaveLength(1);
      // Gone entirely — reconnectable elsewhere as a fresh node.
      expect(await repo.findOwningProject(REPO_A.id)).toBeNull();
    });

    it('refuses to detach the last repository', async () => {
      await installation();
      const projectId = await projectWith('Noesis', [REPO_A]);

      expect(await repo.detachRepository(projectId, REPO_A.id)).toBe(false);
      expect(await repo.listRepositories(projectId)).toHaveLength(1);
    });
  });

  describe('delete', () => {
    it('cascades to the tracked repositories', async () => {
      await installation();
      const projectId = await projectWith('Noesis', [REPO_A, REPO_B]);

      expect(await repo.delete(projectId)).toBe(true);
      expect(await repo.findById(projectId)).toBeNull();
      expect(await repo.findOwningProject(REPO_A.id)).toBeNull();
      expect(await repo.findOwningProject(REPO_B.id)).toBeNull();
    });

    it('frees the name and the repositories for reuse', async () => {
      await installation();
      const projectId = await projectWith('Noesis', [REPO_A]);
      await repo.delete(projectId);

      const again = await projectWith('Noesis', [REPO_A]);
      expect((await repo.findOwningProject(REPO_A.id))?.id).toBe(again);
    });

    it('returns false for an unknown project', async () => {
      expect(await repo.delete('missing')).toBe(false);
    });
  });

  describe('access-check writes', () => {
    it('stamps status_changed_at only on an actual flip', async () => {
      await installation();
      const projectId = await projectWith('Noesis', [REPO_A]);
      const attachedAt = (await repo.listRepositories(projectId))[0]
        ?.status_changed_at;

      await repo.setRepositoryStatus(REPO_A.id, 'disconnected', 'T1');
      let row = (await repo.listRepositories(projectId))[0];
      expect(row?.status).toBe('disconnected');
      expect(row?.status_changed_at).toBe('T1');

      // Same status again: no re-stamp — "disconnected since T1" stays true.
      await repo.setRepositoryStatus(REPO_A.id, 'disconnected', 'T2');
      row = (await repo.listRepositories(projectId))[0];
      expect(row?.status_changed_at).toBe('T1');

      await repo.setRepositoryStatus(REPO_A.id, 'connected', 'T3');
      row = (await repo.listRepositories(projectId))[0];
      expect(row?.status).toBe('connected');
      expect(row?.status_changed_at).toBe('T3');
      expect(attachedAt).not.toBe('T3');
    });

    it('refreshes rename/transfer metadata', async () => {
      await installation();
      await projectWith('Noesis', [REPO_A]);

      await repo.refreshRepositoryMetadata(REPO_A.id, 'acme/api-v2', false);
      const owner = await repo.findOwningProject(REPO_A.id);
      const rows = await repo.listRepositories(owner?.id ?? '');
      expect(rows[0]?.full_name).toBe('acme/api-v2');
      expect(rows[0]?.private).toBe(false);
    });
  });

  describe('list', () => {
    it('summarizes installation, repository count and health', async () => {
      await installation();
      const projectId = await projectWith('Noesis', [REPO_A, REPO_B]);
      await repo.setRepositoryStatus(REPO_A.id, 'disconnected', 'T1');

      const summaries = await repo.list();
      expect(summaries).toHaveLength(1);
      expect(summaries[0]?.id).toBe(projectId);
      expect(summaries[0]?.installation_id).toBe('inst-1');
      expect(summaries[0]?.repository_count).toBe(2);
      expect(summaries[0]?.disconnected_count).toBe(1);
    });
  });
});
