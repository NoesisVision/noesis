import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { ChangeSlug } from '#backend/app/changes/change-slug';
import { SearchService } from '#backend/app/search/search.service';
import { createUiApp } from '#backend/ui/ui.routes';
import {
  decodedDesignDocFixture,
  designDocFixture,
} from '../fixtures/design-doc.fixture';
import { type TestNoesis, testNoesis } from './test-noesis';

// Through the ui app rather than the sub-app alone: the change comes from the
// mount path (`/changes/:change/design-docs`), which is what is under test.
// The surface only reads; documents get in through the MCP tools, so the
// tests seed them through the service.

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
    await t.designDocsService.create(slug, decodedDesignDocFixture);

    const listed = await app.request(BASE);
    expect(listed.status).toBe(200);
    const { designDocs } = (await listed.json()) as {
      designDocs: { name: string }[];
    };
    expect(designDocs.map((d) => d.name)).toEqual([
      'Partial refunds for orders',
    ]);
  });

  it('serves a stored document whole, and 404s a missing one', async () => {
    const created = await t.designDocsService.create(
      slug,
      decodedDesignDocFixture,
    );

    const res = await app.request(`${BASE}/${created.id}`);
    expect(res.status).toBe(200);
    const detail = (await res.json()) as {
      summary: { id: string };
      document: {
        description: { value: string };
        buildingBlocks: { added: { id: string }[] };
      };
    };
    expect(detail.summary.id).toBe(created.id);
    expect(detail.document.description.value).toBe(
      designDocFixture.description.value,
    );
    // Element ids travel as the strings they are written as.
    expect(detail.document.buildingBlocks.added.map((b) => b.id)).toEqual([
      'building_block|sales.refunds.Refund',
      'building_block|sales.refunds.RefundIssued',
      'building_block|sales.refunds.RefundRepository',
    ]);

    expect((await app.request(`${BASE}/missing`)).status).toBe(404);
  });

  // Authoring and removal are the agent's, through the MCP tools.
  it('writes nothing: POST, PUT and DELETE are not routes of this surface', async () => {
    const created = await t.designDocsService.create(
      slug,
      decodedDesignDocFixture,
    );
    const send = (method: string, path: string) =>
      app.request(path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ document: designDocFixture }),
      });

    expect((await send('POST', BASE)).status).toBe(404);
    expect((await send('PUT', `${BASE}/${created.id}`)).status).toBe(404);
    expect((await send('DELETE', `${BASE}/${created.id}`)).status).toBe(404);
    expect((await t.designDocsService.list(slug)).map((d) => d.id)).toEqual([
      created.id,
    ]);
  });

  it('404s every route of a change that does not exist', async () => {
    const missing = '/changes/nope/design-docs';
    for (const res of [
      await app.request(missing),
      await app.request(`${missing}/x`),
    ]) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'change_not_found' });
    }
  });
});
