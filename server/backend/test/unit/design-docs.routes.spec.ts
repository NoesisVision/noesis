import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createUiApp } from '#backend/adapters/in/ui/ui.routes';
import type { ChangeId } from '#backend/app/changes/change-id';
import {
  decodedDesignDocFixture,
  designDocFixture,
} from '../fixtures/design-doc.fixture';
import { type TestNoesis, testNoesis } from './test-noesis';

// Through the ui app rather than the sub-app alone: the change comes from the
// mount path (`/changes/:change/design-docs`), which is what is under test.
// The surface only reads; design documents get in through the MCP tools, so
// the tests write them into the change directly.

const CHANGE = '2026-01-01-booking';
const BASE = `/changes/${CHANGE}/design-docs`;

let t: TestNoesis;
let change: ChangeId;
let app: ReturnType<typeof createUiApp>;

beforeEach(async () => {
  t = await testNoesis();
  change = await t.createChange(CHANGE);
  app = createUiApp(t);
});

afterEach(() => t.cleanup());

describe('ui design-docs routes', () => {
  // The change lists them: `GET /changes/:id`.
  it('lists nothing of its own', async () => {
    await t.writeDesignDoc(change, designDocFixture);

    expect((await app.request(BASE)).status).toBe(404);
  });

  it('serves a stored document whole, and 404s a missing one', async () => {
    await t.writeDesignDoc(change, designDocFixture);
    const created = decodedDesignDocFixture;

    const res = await app.request(`${BASE}/${created.id}`);
    expect(res.status).toBe(200);
    const detail = (await res.json()) as {
      document: {
        id: string;
        description: string;
        buildingBlocks: { added: { id: string }[] };
      };
    };
    expect(detail.document.id).toBe(created.id);
    expect(detail.document.description).toBe(designDocFixture.description);
    // Element ids travel as the strings they are written as.
    expect(detail.document.buildingBlocks.added.map((b) => b.id)).toEqual([
      'building_block|sales.refunds.Refund',
      'building_block|sales.refunds.RefundIssued',
      'building_block|sales.refunds.RefundRepository',
    ]);

    expect((await app.request(`${BASE}/2026-01-01-missing`)).status).toBe(404);
    expect((await app.request(`${BASE}/missing`)).status).toBe(404);
  });

  it('answers the document and nothing rebuilt from it', async () => {
    await t.writeDesignDoc(change, designDocFixture);

    const res = await app.request(`${BASE}/${designDocFixture.id}`);

    // The tree a reader navigates the document by is the document itself,
    // rebuilt; the page does that for itself.
    expect(Object.keys((await res.json()) as object).toSorted()).toEqual([
      'document',
    ]);
  });

  // Authoring and removal are the agent's, through the MCP tools.
  it('writes nothing: POST, PUT and DELETE are not routes of this surface', async () => {
    await t.writeDesignDoc(change, designDocFixture);
    const created = decodedDesignDocFixture;
    const send = (method: string, path: string) =>
      app.request(path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ document: designDocFixture }),
      });

    expect((await send('POST', BASE)).status).toBe(404);
    expect((await send('PUT', `${BASE}/${created.id}`)).status).toBe(404);
    expect((await send('DELETE', `${BASE}/${created.id}`)).status).toBe(404);
    expect((await t.stored(change)).designDocs.map((d) => d.id)).toEqual([
      created.id,
    ]);
  });

  it('404s a design document of a change that does not exist', async () => {
    const missing = '/changes/2026-01-01-nope/design-docs';
    const res = await app.request(`${missing}/2026-01-01-x`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'change_not_found' });
  });
});
