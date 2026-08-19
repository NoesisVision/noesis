import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import type { DatabaseService } from '../../src/database/database.service.js';
import { DesignDocsRepository } from '../../src/design-docs/design-docs.repository.js';
import { ProjectsRepository } from '../../src/projects/projects.repository.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';

let db: DatabaseService;
let designDocs: DesignDocsRepository;
let projects: ProjectsRepository;

beforeAll(async () => {
  db = await sharedTestDatabase();
  designDocs = new DesignDocsRepository(db);
  projects = new ProjectsRepository(db);
});

afterEach(resetGraph);

async function projectId(): Promise<string> {
  const project = await projects.create('Clinic');
  if (project === null) throw new Error('project creation failed');
  return project.id;
}

describe('DesignDocsRepository', () => {
  it('creates a design document under an existing project and reads it back', async () => {
    const pid = await projectId();

    const created = await designDocs.create(pid, designDocFixture);

    expect(created).not.toBeNull();
    expect(created?.name).toBe('Appointment booking');
    expect(created?.project_id).toBe(pid);

    const found = await designDocs.findById(designDocFixture.id);
    expect(found?.status).toBe('draft');
    expect(JSON.parse(found?.document ?? '')).toEqual(designDocFixture);
  });

  it('refuses to create under a project that does not exist', async () => {
    expect(await designDocs.create('no-such-project', designDocFixture)).toBe(
      null,
    );
    expect(await designDocs.findById(designDocFixture.id)).toBe(null);
  });

  it('lists only the documents of the asked-for project, newest date first', async () => {
    const pid = await projectId();
    const other = await projects.create('Other');
    if (other === null) throw new Error('project creation failed');

    await designDocs.create(pid, {
      ...designDocFixture,
      id: 'doc-old',
      name: 'Older',
      date: '2026-01-01',
    });
    await designDocs.create(pid, {
      ...designDocFixture,
      id: 'doc-new',
      name: 'Newer',
      date: '2026-08-01',
    });
    await designDocs.create(other.id, {
      ...designDocFixture,
      id: 'doc-elsewhere',
    });

    const listed = await designDocs.listByProject(pid);
    expect(listed.map((d) => d.id)).toEqual(['doc-new', 'doc-old']);
  });

  it('deletes a document and reports a missing one', async () => {
    const pid = await projectId();
    await designDocs.create(pid, designDocFixture);

    expect(await designDocs.delete(designDocFixture.id)).toBe(true);
    expect(await designDocs.findById(designDocFixture.id)).toBe(null);
    expect(await designDocs.delete(designDocFixture.id)).toBe(false);
  });
});
