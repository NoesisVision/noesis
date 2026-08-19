import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import type { DatabaseService } from '../../src/database/database.service.js';
import { DesignDocsRepository } from '../../src/design-docs/design-docs.repository.js';
import {
  DesignDocProjectNotFoundError,
  DesignDocsService,
  InvalidDesignDocumentError,
} from '../../src/design-docs/design-docs.service.js';
import { ProjectsRepository } from '../../src/projects/projects.repository.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';

let db: DatabaseService;
let service: DesignDocsService;
let projects: ProjectsRepository;

beforeAll(async () => {
  db = await sharedTestDatabase();
  service = new DesignDocsService(new DesignDocsRepository(db));
  projects = new ProjectsRepository(db);
});

afterEach(resetGraph);

async function projectId(): Promise<string> {
  const project = await projects.create('Clinic');
  if (project === null) throw new Error('project creation failed');
  return project.id;
}

describe('DesignDocsService', () => {
  it('stores a valid document under a server-minted id and reads it back whole', async () => {
    const pid = await projectId();

    const summary = await service.create(pid, designDocFixture);

    // The server mints the id — whatever the input carried is replaced.
    expect(summary.id).not.toBe(designDocFixture.id);
    expect(summary.projectId).toBe(pid);
    expect(summary.name).toBe('Appointment booking');

    const detail = await service.findById(summary.id);
    expect(detail?.document).toEqual({
      ...designDocFixture,
      id: summary.id,
    });
  });

  it('rejects a document that does not parse', async () => {
    const pid = await projectId();
    expect(service.create(pid, { name: 42 })).rejects.toBeInstanceOf(
      InvalidDesignDocumentError,
    );
  });

  it('rejects a document with an integrity error, naming the issue', async () => {
    const pid = await projectId();
    const broken = {
      ...designDocFixture,
      // Both use cases point at an application service that does not exist.
      buildingBlocks: designDocFixture.buildingBlocks.filter(
        (b) => b.id !== 'svc-booking',
      ),
    };

    expect(service.create(pid, broken)).rejects.toBeInstanceOf(
      InvalidDesignDocumentError,
    );
    expect(await service.listByProject(pid)).toEqual([]);
  });

  it('refuses a project that does not exist', async () => {
    expect(
      service.create('no-such-project', designDocFixture),
    ).rejects.toBeInstanceOf(DesignDocProjectNotFoundError);
  });

  it('creates the sample document dated today', async () => {
    const pid = await projectId();

    const summary = await service.createSample(pid);

    expect(summary.name).toBe('Appointment booking');
    expect(summary.date).toBe(new Date().toISOString().slice(0, 10));
    const listed = await service.listByProject(pid);
    expect(listed.map((d) => d.id)).toEqual([summary.id]);
  });

  it('answers null for a document that does not exist', async () => {
    expect(await service.findById('missing')).toBe(null);
  });
});
