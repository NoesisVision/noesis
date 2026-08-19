import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import type { DatabaseService } from '../../src/database/database.service.js';
import { DesignDocsRepository } from '../../src/design-docs/design-docs.repository.js';
import { DesignDocsService } from '../../src/design-docs/design-docs.service.js';
import { ProjectsRepository } from '../../src/projects/projects.repository.js';
import { createDesignDocsApp } from '../../src/ui/design-docs/design-docs.routes.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';

// The sub-app in isolation — `requireSession` guards the whole /ui surface
// above it (ui.routes.ts), so these specs exercise only the design-doc
// behaviour: the boundary validation and the explainable refusals.

let db: DatabaseService;
let projects: ProjectsRepository;
let app: ReturnType<typeof createDesignDocsApp>;

beforeAll(async () => {
  db = await sharedTestDatabase();
  projects = new ProjectsRepository(db);
  app = createDesignDocsApp({
    designDocsService: new DesignDocsService(new DesignDocsRepository(db)),
  });
});

afterEach(resetGraph);

async function projectId(): Promise<string> {
  const project = await projects.create('Clinic');
  if (project === null) throw new Error('project creation failed');
  return project.id;
}

const post = (path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('ui design-docs routes', () => {
  it('lists a project’s documents, and refuses a listing without a project', async () => {
    const pid = await projectId();
    const created = await post('/', {
      projectId: pid,
      document: designDocFixture,
    });
    expect(created.status).toBe(201);

    const listed = await app.request(`/?projectId=${pid}`);
    expect(listed.status).toBe(200);
    const { designDocs } = (await listed.json()) as {
      designDocs: { name: string }[];
    };
    expect(designDocs.map((d) => d.name)).toEqual(['Appointment booking']);

    expect((await app.request('/')).status).toBe(400);
  });

  it('serves a stored document whole, and 404s a missing one', async () => {
    const pid = await projectId();
    const created = await post('/', {
      projectId: pid,
      document: designDocFixture,
    });
    const { designDoc } = (await created.json()) as {
      designDoc: { id: string };
    };

    const res = await app.request(`/${designDoc.id}`);
    expect(res.status).toBe(200);
    const detail = (await res.json()) as {
      summary: { id: string };
      document: { goal: string; useCases: unknown[] };
    };
    expect(detail.summary.id).toBe(designDoc.id);
    expect(detail.document.goal).toBe(designDocFixture.goal);
    expect(detail.document.useCases).toHaveLength(2);

    expect((await app.request('/missing')).status).toBe(404);
  });

  it('rejects an invalid document with its issues, and an unknown project with 404', async () => {
    const pid = await projectId();

    const invalid = await post('/', {
      projectId: pid,
      document: { ...designDocFixture, useCases: 'not-a-list' },
    });
    expect(invalid.status).toBe(400);
    expect(((await invalid.json()) as { error: string }).error).toBe(
      'invalid_document',
    );

    const orphan = await post('/', {
      projectId: 'no-such-project',
      document: designDocFixture,
    });
    expect(orphan.status).toBe(404);
    expect(((await orphan.json()) as { error: string }).error).toBe(
      'project_not_found',
    );
  });

  it('creates the sample document for a project', async () => {
    const pid = await projectId();

    const res = await post('/sample', { projectId: pid });

    expect(res.status).toBe(201);
    const { designDoc } = (await res.json()) as {
      designDoc: { name: string; projectId: string };
    };
    expect(designDoc.name).toBe('Appointment booking');
    expect(designDoc.projectId).toBe(pid);
  });

  it('deletes a document, 404s the second attempt', async () => {
    const pid = await projectId();
    const created = await post('/sample', { projectId: pid });
    const { designDoc } = (await created.json()) as {
      designDoc: { id: string };
    };

    const first = await app.request(`/${designDoc.id}`, { method: 'DELETE' });
    expect(first.status).toBe(204);
    const second = await app.request(`/${designDoc.id}`, { method: 'DELETE' });
    expect(second.status).toBe(404);
  });
});
