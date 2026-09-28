import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createUiApp } from '#backend/adapters/in/ui/ui.routes';
import type { ChangeId } from '#backend/app/changes/change-id';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import { SearchService } from '#backend/app/search/search.service';
import {
  decodedDesignDocFixture,
  designDocFixture,
  greenFieldDesignDocFixture,
  humanEditedDesignDocFixture,
} from '../fixtures/design-doc.fixture';
import { type TestNoesis, testNoesis } from './test-noesis';

// Through the ui app rather than the sub-app alone: the change comes from the
// mount path (`/changes/:change/design-docs`), which is what is under test.
// The agent creates design documents through the MCP tools, so the tests seed
// them through the service.

const CHANGE = '2026-01-01-booking';
const BASE = `/changes/${CHANGE}/design-docs`;

let t: TestNoesis;
let change: ChangeId;
let app: ReturnType<typeof createUiApp>;

beforeEach(async () => {
  t = await testNoesis();
  change = await t.createChange(CHANGE);
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
    await t.writeDesignDoc(change, designDocFixture);

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

  const send = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const { id: ID, ...byAgent } = greenFieldDesignDocFixture;
  const { id: _id, ...byHuman } = humanEditedDesignDocFixture;

  it('revises a design document whole, as a human', async () => {
    await t.writeDesignDoc(change, greenFieldDesignDocFixture);

    const res = await send('PUT', `${BASE}/${ID}`, {
      ...byHuman,
      implemented: true,
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      designDoc: { id: ID, name: byHuman.name, implemented: true },
    });
    const stored = await t.designDocsService.findById(
      change,
      DesignDocId.parse(ID),
    );
    expect(stored.implemented).toBe(true);
    expect(JSON.stringify(stored)).toContain('"author":"human"');
  });

  it('answers a revision that breaks the rules with each field to fix, keeping the stored one', async () => {
    await t.writeDesignDoc(change, greenFieldDesignDocFixture);
    const stored = await t.designDocsService.findById(
      change,
      DesignDocId.parse(ID),
    );

    const res = await send('PUT', `${BASE}/${ID}`, {
      ...byAgent,
      buildingBlocks: {
        ...byAgent.buildingBlocks,
        removed: ['building_block|sales.credit-notes.CreditNote'],
      },
    });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: 'invalid_design_doc',
      violations: [
        {
          path: 'buildingBlocks.removed[building_block|sales.credit-notes.CreditNote]',
          reason: 'changedInGreenField',
        },
      ],
    });
    expect(
      await t.designDocsService.findById(change, DesignDocId.parse(ID)),
    ).toEqual(stored);
  });

  it('refuses a body that is not a design document, and an id it does not have', async () => {
    await t.writeDesignDoc(change, greenFieldDesignDocFixture);

    const wrapped = await send('PUT', `${BASE}/${ID}`, { document: byAgent });
    const missing = await send('PUT', `${BASE}/2026-01-01-missing`, byAgent);

    expect(wrapped.status).toBe(400);
    expect(((await wrapped.json()) as { error: string }).error).toBe(
      'invalid_body',
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'not_found' });
  });

  it('never creates or removes one: POST and DELETE are not routes of this surface', async () => {
    await t.writeDesignDoc(change, greenFieldDesignDocFixture);

    expect((await send('POST', BASE, byAgent)).status).toBe(404);
    expect((await send('DELETE', `${BASE}/${ID}`)).status).toBe(404);
    expect((await t.designDocsService.list(change)).map((d) => d.id)).toEqual([
      DesignDocId.parse(ID),
    ]);
  });

  it('404s every route of a change that does not exist', async () => {
    const missing = '/changes/2026-01-01-nope/design-docs';
    for (const res of [
      await app.request(missing),
      await app.request(`${missing}/2026-01-01-x`),
      await send('PUT', `${missing}/${ID}`, byAgent),
    ]) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'change_not_found' });
    }
  });
});
