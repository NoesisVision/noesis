import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createUiApp } from '#backend/adapters/in/ui/ui.routes';
import type { ChangeId } from '#backend/app/changes/change-id';
import type { Document } from '#backend/app/information-sources/document';
import { DocumentId } from '#backend/app/information-sources/document-id';
import { MAX_WORKING_FILE_BYTES } from '#backend/platform/files/working-file-limit';
import { type TestNoesis, testNoesis } from './test-noesis';

// Through the ui app rather than the sub-app alone: the change comes from the
// mount path (`/changes/:change/documents`), which is what is under test.

const CHANGE = '2026-01-01-booking';
const ID = '2026-09-18-booking-rules';
const BASE = `/changes/${CHANGE}/documents`;

const document: Document = {
  id: DocumentId.parse(ID),
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

describe('ui documents routes', () => {
  it('serves a stored document whole, and 404s a missing one', async () => {
    await t.writeDocument(change, document);

    const res = await app.request(`${BASE}/${ID}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      document: { id: ID, content: 'A slot may be booked once.' },
    });

    expect((await app.request(`${BASE}/2026-09-18-missing`)).status).toBe(404);
    expect((await app.request(`${BASE}/Not_An_Id`)).status).toBe(404);
    expect((await app.request(`${BASE}/booking-rules`)).status).toBe(404);
  });

  const send = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it('adds a document at an id minted from today and its title', async () => {
    const { id: _id, ...content } = document;

    const res = await send('POST', BASE, content);

    expect(res.status).toBe(201);
    const minted = '2026-09-24-booking-rules';
    expect(await res.json()).toEqual({
      document: { id: minted, title: content.title, date: content.date },
    });
    const stored = await t.findDocument.handle({
      change,
      id: DocumentId.parse(minted),
    });
    expect(stored.content).toBe(content.content);
  });

  it('refuses a document that does not fit, with the issues to fix', async () => {
    const res = await send('POST', BASE, { title: 'No date', content: 42 });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; issues: unknown };
    expect(body.error).toBe('invalid_body');
    expect(JSON.stringify(body.issues)).toContain('date');
    expect(await t.documentsIn(change)).toEqual([]);
  });

  it('refuses a body that is not JSON, or not sent as JSON', async () => {
    const malformed = await app.request(BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not json',
    });
    const asText = await app.request(BASE, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ title: 'T', date: '2026-09-18', content: 'x' }),
    });

    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'invalid_body' });
    expect(asText.status).toBe(400);
    expect(await t.documentsIn(change)).toEqual([]);
  });

  it('refuses a body larger than a working file may be', async () => {
    const res = await send('POST', BASE, {
      title: 'Huge',
      date: '2026-09-18',
      content: 'x'.repeat(MAX_WORKING_FILE_BYTES),
    });

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      error: 'payload_too_large',
      limit: MAX_WORKING_FILE_BYTES,
    });
  });

  it('removes a document, and 404s one it does not have', async () => {
    await t.writeDocument(change, document);

    const removed = await send('DELETE', `${BASE}/${ID}`);
    const again = await send('DELETE', `${BASE}/${ID}`);

    expect(removed.status).toBe(204);
    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({ error: 'not_found' });
    expect(await t.documentsIn(change)).toEqual([]);
  });

  it('never lists one kind alone: the change answers what it holds', async () => {
    expect((await app.request(BASE)).status).toBe(404);
  });

  it('never revises a document: PUT is not a route of this surface', async () => {
    await t.writeDocument(change, document);

    const res = await send('PUT', `${BASE}/${ID}`, document);

    expect(res.status).toBe(404);
    expect(await t.findDocument.handle({ change, id: document.id })).toEqual(
      document,
    );
  });

  it('404s every route of a change that does not exist', async () => {
    const other = '/changes/2026-01-01-nope/documents';
    const { id: _id, ...content } = document;

    for (const res of [
      await app.request(`${other}/${ID}`),
      await send('POST', other, content),
      await send('DELETE', `${other}/${ID}`),
    ]) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'change_not_found' });
    }
  });
});
