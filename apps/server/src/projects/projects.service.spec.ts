import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { ConcurrencyConflictError } from '../database/concurrency';
import { resetGraph, sharedTestDatabase } from '../testing/test-db';
import { ProjectsRepository } from './projects.repository';
import { ProjectsService } from './projects.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('ProjectsService', () => {
  let projects: ProjectsService;
  let repository: ProjectsRepository;

  beforeAll(async () => {
    const db = await sharedTestDatabase();
    repository = new ProjectsRepository(db);
    projects = new ProjectsService(repository);
  });

  afterEach(async () => {
    await resetGraph();
  });

  it('mints a server-side UUIDv7 id on create (OQ-2.2)', async () => {
    const project = await projects.create('Noesis');
    expect(project.id).toMatch(UUID_RE);
    expect(project.name).toBe('Noesis');
  });

  it('finds a created project by id and null for unknown ids', async () => {
    const created = await projects.create('Noesis');
    expect(await projects.findById(created.id)).toEqual(created);
    expect(await projects.findById('does-not-exist')).toBeNull();
  });

  it('renames with the current version (optimistic concurrency, OQ-2.3)', async () => {
    const created = await projects.create('Noesis');
    const renamed = await projects.rename(created.id, 'Noesis Vision', 0);
    expect(renamed).toEqual({ id: created.id, name: 'Noesis Vision' });
    // The underlying row's version advanced.
    expect((await repository.findById(created.id))?.version).toBe(1);
  });

  it('rejects a rename with a stale version as a conflict', async () => {
    const created = await projects.create('Noesis');
    await projects.rename(created.id, 'First', 0); // version 0 -> 1

    let error: unknown;
    try {
      await projects.rename(created.id, 'Second', 0);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ConcurrencyConflictError);
    // The losing write did not take effect.
    expect((await projects.findById(created.id))?.name).toBe('First');
  });

  it('throws not-found when renaming a missing project', async () => {
    let error: unknown;
    try {
      await projects.rename('missing', 'x', 0);
    } catch (e) {
      error = e;
    }
    expect((error as Error).message).toContain('not found');
  });
});
