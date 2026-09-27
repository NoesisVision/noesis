import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createUiApp } from '#backend/adapters/in/ui/ui.routes';
import type { ChangeId } from '#backend/app/changes/model/change-id';
import type { SourceDocument } from '#backend/app/changes/model/source-document';
import { SourceDocumentId } from '#backend/app/changes/model/source-document-id';
import { sourceDocumentId } from '../fixtures/ids.fixture';
import { type TestNoesis, testNoesis } from './test-noesis';

// Through the ui app rather than the sub-app alone: the change comes from the
// mount path (`/changes/:change/source-documents`), which is what is under test.
// The reads are fed by writing into the change directly; the writes take the
// same working file the MCP tools read.

const CHANGE = '2026-01-01-booking';
const ID = '0199a1b2-7c3d-7e4f-8a5b-6c7d8e9f0a1c';
const BASE = `/changes/${CHANGE}/source-documents`;

const document: SourceDocument = {
  id: SourceDocumentId.parse(ID),
  title: 'Booking Rules',
  date: '2026-09-18',
  content: 'A slot may be booked once.',
};

let t: TestNoesis;
let change: ChangeId;
let app: ReturnType<typeof createUiApp>;

beforeEach(async () => {
  t = await testNoesis();
  change = await t.writeChange(CHANGE);
  app = createUiApp(t);
});

afterEach(() => t.cleanup());

describe('ui source-documents routes', () => {
  // The change lists them: `GET /changes/:id`.
  it('lists nothing of its own', async () => {
    await t.writeDocument(change, document);

    expect((await app.request(BASE)).status).toBe(404);
  });

  it('serves a stored document whole, and 404s a missing one', async () => {
    await t.writeDocument(change, document);

    const res = await app.request(`${BASE}/${ID}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      sourceDocument: { id: ID, content: 'A slot may be booked once.' },
    });

    expect((await app.request(`${BASE}/${sourceDocumentId(99)}`)).status).toBe(
      404,
    );
    expect((await app.request(`${BASE}/Not_An_Id`)).status).toBe(404);
    expect((await app.request(`${BASE}/2026-09-18-booking-rules`)).status).toBe(
      404,
    );
  });

  const send = (method: string, path: string, body: unknown) =>
    app.request(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  const file = { title: 'Booking Rules', date: '2026-09-18', content: 'Once.' };

  it('adds a source document at an id it mints, and revises it at that id', async () => {
    const added = await send('POST', BASE, file);

    expect(added.status).toBe(201);
    const { sourceDocument } = (await added.json()) as {
      sourceDocument: { id: string };
    };
    expect(sourceDocument.id).toMatch(/^[0-9a-f]{8}-/);
    expect(sourceDocument).toMatchObject({
      title: 'Booking Rules',
      date: '2026-09-18',
    });

    const revised = await send('PUT', `${BASE}/${sourceDocument.id}`, {
      ...file,
      title: 'Booking rules, revised',
    });

    expect(revised.status).toBe(200);
    expect(await revised.json()).toEqual({
      sourceDocument: {
        id: sourceDocument.id,
        title: 'Booking rules, revised',
        date: '2026-09-18',
      },
    });
    expect(
      (await t.stored(change)).sourceDocuments.map((d) => d.content),
    ).toEqual(['Once.']);
  });

  it('refuses a body that is not a source document, adding nothing', async () => {
    const res = await send('POST', BASE, { document: file });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_body' });
    expect((await t.stored(change)).sourceDocuments).toEqual([]);
  });

  it('404s a revision of a source document the change does not hold', async () => {
    const res = await send('PUT', `${BASE}/${ID}`, file);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: 'not_found',
      entity: 'source document',
      id: ID,
      change,
    });
  });

  it('deletes nothing: DELETE is not a route of this surface', async () => {
    await t.writeDocument(change, document);

    expect((await send('DELETE', `${BASE}/${ID}`, {})).status).toBe(404);
    expect((await t.stored(change)).sourceDocuments.map((d) => d.id)).toEqual([
      SourceDocumentId.parse(ID),
    ]);
  });

  it('404s a document of a change that does not exist', async () => {
    const res = await app.request(
      `/changes/2026-01-01-nope/source-documents/${ID}`,
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'change_not_found' });
  });
});
