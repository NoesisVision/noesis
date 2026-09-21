import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { ChangeSlug } from '#backend/app/changes/change-slug';
import { designDocFixture } from '#backend/app/design-docs/model/design-doc.fixture';
import { SearchService } from '#backend/app/search/search.service';
import { createUiApp } from '#backend/ui/ui.routes';
import { type TestNoesis, testNoesis } from './test-noesis';

// Through the ui app rather than the sub-app alone: the change comes from the
// mount path (`/changes/:change/design-docs`), which is what is under test.
// The surface reads and deletes; documents get in through the MCP tools,
// so the tests seed them through the service.

const CHANGE = 'booking';
const BASE = `/changes/${CHANGE}/design-docs`;

let t: TestNoesis;
let slug: ChangeSlug;
let app: ReturnType<typeof createUiApp>;

beforeEach(async () => {
  t = await testNoesis();
  slug = await t.createChange(CHANGE);
  app = createUiApp({
    searchService: new SearchService(),
    changesService: t.changesService,
    designDocsService: t.designDocsService,
    documentsService: t.documentsService,
  });
});

afterEach(() => t.cleanup());

describe('ui design-docs routes', () => {
  it('lists the stored documents of the change', async () => {
    await t.designDocsService.create(slug, designDocFixture);

    const listed = await app.request(BASE);
    expect(listed.status).toBe(200);
    const { designDocs } = (await listed.json()) as {
      designDocs: { name: string }[];
    };
    expect(designDocs.map((d) => d.name)).toEqual(['Appointment booking']);
  });

  it('serves a stored document whole, and 404s a missing one', async () => {
    const created = await t.designDocsService.create(slug, designDocFixture);

    const res = await app.request(`${BASE}/${created.id}`);
    expect(res.status).toBe(200);
    const detail = (await res.json()) as {
      summary: { id: string };
      document: { goal: string; useCases: unknown[] };
    };
    expect(detail.summary.id).toBe(created.id);
    expect(detail.document.goal).toBe(designDocFixture.goal);
    expect(detail.document.useCases).toHaveLength(2);

    expect((await app.request(`${BASE}/missing`)).status).toBe(404);
  });

  // Authoring is the agent's through `create-design-doc` / `update-design-doc`.
  it('does not create documents: POST is not a route of this surface', async () => {
    const post = (path: string) =>
      app.request(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ document: designDocFixture }),
      });

    expect((await post(BASE)).status).toBe(404);
    expect((await post(`${BASE}/sample`)).status).toBe(404);
    expect(await t.designDocsService.list(slug)).toEqual([]);
  });

  it('deletes a document, 404s the second attempt', async () => {
    const created = await t.designDocsService.create(slug, designDocFixture);

    const first = await app.request(`${BASE}/${created.id}`, {
      method: 'DELETE',
    });
    expect(first.status).toBe(204);
    const second = await app.request(`${BASE}/${created.id}`, {
      method: 'DELETE',
    });
    expect(second.status).toBe(404);
  });

  it('404s every route of a change that does not exist', async () => {
    const missing = '/changes/nope/design-docs';
    for (const res of [
      await app.request(missing),
      await app.request(`${missing}/x`),
      await app.request(`${missing}/x`, { method: 'DELETE' }),
    ]) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'change_not_found' });
    }
  });
});
