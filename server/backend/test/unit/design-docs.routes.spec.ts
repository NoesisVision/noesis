import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import type { DatabaseService } from '../../src/database/database.service.js';
import { DesignDocsRepository } from '../../src/design-docs/design-docs.repository.js';
import { DesignDocsService } from '../../src/design-docs/design-docs.service.js';
import { createDesignDocsApp } from '../../src/ui/design-docs/design-docs.routes.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';

// The sub-app in isolation: the boundary validation and the explainable
// refusals. Documents are top-level — the server serves one checkout.

let db: DatabaseService;
let app: ReturnType<typeof createDesignDocsApp>;

beforeAll(async () => {
  db = await sharedTestDatabase();
  app = createDesignDocsApp({
    designDocsService: new DesignDocsService(new DesignDocsRepository(db)),
  });
});

afterEach(resetGraph);

const post = (path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('ui design-docs routes', () => {
  it('lists the stored documents', async () => {
    const created = await post('/', { document: designDocFixture });
    expect(created.status).toBe(201);

    const listed = await app.request('/');
    expect(listed.status).toBe(200);
    const { designDocs } = (await listed.json()) as {
      designDocs: { name: string }[];
    };
    expect(designDocs.map((d) => d.name)).toEqual(['Appointment booking']);
  });

  it('serves a stored document whole, and 404s a missing one', async () => {
    const created = await post('/', { document: designDocFixture });
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

  it('rejects an invalid document with its issues', async () => {
    const invalid = await post('/', {
      document: { ...designDocFixture, useCases: 'not-a-list' },
    });
    expect(invalid.status).toBe(400);
    expect(((await invalid.json()) as { error: string }).error).toBe(
      'invalid_document',
    );
  });

  it('creates the sample document', async () => {
    const res = await post('/sample', {});

    expect(res.status).toBe(201);
    const { designDoc } = (await res.json()) as {
      designDoc: { name: string };
    };
    expect(designDoc.name).toBe('Appointment booking');
  });

  it('deletes a document, 404s the second attempt', async () => {
    const created = await post('/sample', {});
    const { designDoc } = (await created.json()) as {
      designDoc: { id: string };
    };

    const first = await app.request(`/${designDoc.id}`, { method: 'DELETE' });
    expect(first.status).toBe(204);
    const second = await app.request(`/${designDoc.id}`, { method: 'DELETE' });
    expect(second.status).toBe(404);
  });
});
