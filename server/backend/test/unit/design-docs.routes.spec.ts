import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createUiApp } from '#backend/adapters/in/ui/ui.routes';
import type { ChangeId } from '#backend/app/changes/model/change-id';
import {
  decodedDesignDocFixture,
  designDocFixture,
} from '../fixtures/design-doc.fixture';
import { designDocId } from '../fixtures/ids.fixture';
import { type TestNoesis, testNoesis } from './test-noesis';

// Through the ui app rather than the sub-app alone: the change comes from the
// mount path (`/changes/:change/design-docs`), which is what is under test.
// The reads are fed by writing into the change directly; the writes take the
// same working file the MCP tools read.

const CHANGE = '2026-01-01-booking';
const BASE = `/changes/${CHANGE}/design-docs`;

let t: TestNoesis;
let change: ChangeId;
let app: ReturnType<typeof createUiApp>;

beforeEach(async () => {
  t = await testNoesis();
  change = await t.writeChange(CHANGE);
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
      designDoc: {
        id: string;
        description: string;
        buildingBlocks: { added: { id: string }[] };
      };
    };
    expect(detail.designDoc.id).toBe(created.id);
    expect(detail.designDoc.description).toBe(designDocFixture.description);
    // Element ids travel as the strings they are written as.
    expect(detail.designDoc.buildingBlocks.added.map((b) => b.id)).toEqual([
      'building_block|sales.refunds.Refund',
      'building_block|sales.refunds.RefundIssued',
      'building_block|sales.refunds.RefundRepository',
    ]);

    expect((await app.request(`${BASE}/${designDocId(99)}`)).status).toBe(404);
    expect((await app.request(`${BASE}/missing`)).status).toBe(404);
  });

  it('answers the document and nothing rebuilt from it', async () => {
    await t.writeDesignDoc(change, designDocFixture);

    const res = await app.request(`${BASE}/${designDocFixture.id}`);

    // The tree a reader navigates the document by is the document itself,
    // rebuilt; the page does that for itself.
    expect(Object.keys((await res.json()) as object).toSorted()).toEqual([
      'designDoc',
    ]);
  });

  const send = (method: string, path: string, body: unknown) =>
    app.request(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  const greenField = (name: string) => ({
    name,
    description: 'Refunds by line.',
    modules: {
      added: [
        {
          id: 'module|sales.refunds',
          name: { value: 'refunds' },
          description: { value: 'Giving money back.' },
        },
      ],
    },
  });

  it('adds a design document at an id it mints, and revises it at that id', async () => {
    const added = await send('POST', BASE, greenField('Partial refunds'));

    expect(added.status).toBe(201);
    const { designDoc } = (await added.json()) as {
      designDoc: { id: string; name: string; implemented: boolean };
    };
    expect(designDoc).toMatchObject({
      name: 'Partial refunds',
      implemented: false,
    });

    const revised = await send(
      'PUT',
      `${BASE}/${designDoc.id}`,
      greenField('Refunds by line'),
    );

    expect(revised.status).toBe(200);
    expect(await revised.json()).toEqual({
      designDoc: {
        id: designDoc.id,
        name: 'Refunds by line',
        implemented: false,
      },
    });
    expect((await t.stored(change)).designDocs.map((d) => d.name)).toEqual([
      'Refunds by line',
    ]);
  });

  it('answers a design document that breaks its rules with 422 and each violation', async () => {
    const { id: _, ...file } = designDocFixture;
    const res = await send('POST', BASE, file);

    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      error: string;
      violations: { path: string; reason: string }[];
    };
    expect(body.error).toBe('invalid_design_doc');
    expect(body.violations).toContainEqual({
      path: 'modules.removed[module|sales.credit-notes]',
      reason: 'changedInGreenField',
    });
    expect((await t.stored(change)).designDocs).toEqual([]);
  });

  it('404s a revision of a design document the change does not hold', async () => {
    const res = await send(
      'PUT',
      `${BASE}/${designDocId(99)}`,
      greenField('Nothing'),
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: 'not_found',
      entity: 'design document',
      id: designDocId(99),
      change,
    });
  });

  it('deletes nothing: DELETE is not a route of this surface', async () => {
    await t.writeDesignDoc(change, designDocFixture);
    const { id } = decodedDesignDocFixture;

    expect((await send('DELETE', `${BASE}/${id}`, {})).status).toBe(404);
    expect((await t.stored(change)).designDocs.map((d) => d.id)).toEqual([id]);
  });

  it('404s a design document of a change that does not exist', async () => {
    const missing = '/changes/2026-01-01-nope/design-docs';
    const res = await app.request(`${missing}/${designDocId(99)}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'change_not_found' });
  });
});
