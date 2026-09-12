import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import { SearchService } from '../../src/ui/search/search.service.js';
import { createUiApp } from '../../src/ui/ui.routes.js';
import { type TestNoesis, testNoesis } from './test-noesis.js';

// Through the ui app rather than the sub-app alone: the change comes from the
// mount path (`/changes/:change/design-docs`), which is what is under test.

const CHANGE = 'booking';
const BASE = `/changes/${CHANGE}/design-docs`;

let t: TestNoesis;
let app: ReturnType<typeof createUiApp>;

beforeEach(async () => {
  t = await testNoesis();
  await t.changesRepository.create(CHANGE);
  app = createUiApp({
    searchService: new SearchService(),
    changesService: t.changesService,
    designDocsService: t.designDocsService,
  });
});

afterEach(() => t.cleanup());

const post = (path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('ui design-docs routes', () => {
  it('lists the stored documents of the change', async () => {
    const created = await post(BASE, { document: designDocFixture });
    expect(created.status).toBe(201);

    const listed = await app.request(BASE);
    expect(listed.status).toBe(200);
    const { designDocs } = (await listed.json()) as {
      designDocs: { name: string }[];
    };
    expect(designDocs.map((d) => d.name)).toEqual(['Appointment booking']);
  });

  it('serves a stored document whole, and 404s a missing one', async () => {
    const created = await post(BASE, { document: designDocFixture });
    const { designDoc } = (await created.json()) as {
      designDoc: { id: string };
    };

    const res = await app.request(`${BASE}/${designDoc.id}`);
    expect(res.status).toBe(200);
    const detail = (await res.json()) as {
      summary: { id: string };
      document: { goal: string; useCases: unknown[] };
    };
    expect(detail.summary.id).toBe(designDoc.id);
    expect(detail.document.goal).toBe(designDocFixture.goal);
    expect(detail.document.useCases).toHaveLength(2);

    expect((await app.request(`${BASE}/missing`)).status).toBe(404);
  });

  it('rejects an invalid document with its issues', async () => {
    const invalid = await post(BASE, {
      document: { ...designDocFixture, useCases: 'not-a-list' },
    });
    expect(invalid.status).toBe(400);
    expect(((await invalid.json()) as { error: string }).error).toBe(
      'invalid_document',
    );
  });

  it('creates the sample document', async () => {
    const res = await post(`${BASE}/sample`, {});

    expect(res.status).toBe(201);
    const { designDoc } = (await res.json()) as {
      designDoc: { name: string };
    };
    expect(designDoc.name).toBe('Appointment booking');
  });

  it('deletes a document, 404s the second attempt', async () => {
    const created = await post(`${BASE}/sample`, {});
    const { designDoc } = (await created.json()) as {
      designDoc: { id: string };
    };

    const first = await app.request(`${BASE}/${designDoc.id}`, {
      method: 'DELETE',
    });
    expect(first.status).toBe(204);
    const second = await app.request(`${BASE}/${designDoc.id}`, {
      method: 'DELETE',
    });
    expect(second.status).toBe(404);
  });

  it('404s every route of a change that does not exist', async () => {
    const missing = '/changes/nope/design-docs';
    for (const res of [
      await app.request(missing),
      await post(missing, { document: designDocFixture }),
      await post(`${missing}/sample`, {}),
      await app.request(`${missing}/x`),
      await app.request(`${missing}/x`, { method: 'DELETE' }),
    ]) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'change_not_found' });
    }
  });
});
