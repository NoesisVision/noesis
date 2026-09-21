import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { z } from 'zod';
import type { DocumentSchema } from '#backend/app/information-sources/model/document';
import { SearchService } from '#backend/app/search/search.service';
import { createUiApp } from '#backend/ui/ui.routes';
import { type TestNoesis, testNoesis } from './test-noesis';

// Through the ui app rather than the sub-app alone: the change comes from the
// mount path (`/changes/:change/documents`), which is what is under test.

const CHANGE = 'booking';
const BASE = `/changes/${CHANGE}/documents`;

const document: z.input<typeof DocumentSchema> = {
  document_id: 'whatever-the-caller-sent',
  title: 'Booking Rules',
  date: '2026-09-18',
  content: 'A slot may be booked once.',
};

let t: TestNoesis;
let app: ReturnType<typeof createUiApp>;

beforeEach(async () => {
  t = await testNoesis();
  await t.createChange(CHANGE);
  app = createUiApp({
    searchService: new SearchService(),
    changesService: t.changesService,
    designDocsService: t.designDocsService,
    documentsService: t.documentsService,
  });
});

afterEach(() => t.cleanup());

const send = (method: string, path: string, body: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const post = (path: string, body: unknown) => send('POST', path, body);
const put = (path: string, body: unknown) => send('PUT', path, body);

describe('ui documents routes', () => {
  it('creates a document under the slug of its title and lists it', async () => {
    const created = await post(BASE, { document });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      document: { id: 'booking-rules', title: 'Booking Rules' },
    });

    const listed = await app.request(BASE);
    expect(listed.status).toBe(200);
    const { documents } = (await listed.json()) as {
      documents: { id: string }[];
    };
    expect(documents.map((d) => d.id)).toEqual(['booking-rules']);
  });

  it('serves a stored document whole, and 404s a missing one', async () => {
    await post(BASE, { document });

    const res = await app.request(`${BASE}/booking-rules`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      summary: { id: 'booking-rules' },
      document: { content: 'A slot may be booked once.' },
    });

    expect((await app.request(`${BASE}/missing`)).status).toBe(404);
    expect((await app.request(`${BASE}/Not_An_Id`)).status).toBe(404);
  });

  it('rejects a document the contract refuses, before anything is written', async () => {
    const res = await post(BASE, { document: { title: 'No date' } });

    // The document's own contract runs in the middleware (decision D3), so a
    // body that does not satisfy it never reaches the handler.
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: string;
      issues: { fieldErrors: Record<string, string[]> };
    };
    expect(body.error).toBe('invalid_body');
    expect(body.issues.fieldErrors.document?.length).toBeGreaterThan(0);
    expect((await app.request(BASE)).status).toBe(200);
    const { documents } = (await (await app.request(BASE)).json()) as {
      documents: unknown[];
    };
    expect(documents).toEqual([]);
  });

  it('409s a second document with the same title', async () => {
    await post(BASE, { document });

    const res = await post(BASE, { document });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: 'duplicate_document',
      title: 'Booking Rules',
    });
  });

  it('replaces the content under the same id', async () => {
    await post(BASE, { document });

    const res = await put(`${BASE}/booking-rules`, {
      document: { ...document, content: 'A slot may be booked twice.' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      document: { id: 'booking-rules' },
    });
    expect(
      await (await app.request(`${BASE}/booking-rules`)).json(),
    ).toMatchObject({ document: { content: 'A slot may be booked twice.' } });
  });

  it('moves the document when the title changes', async () => {
    await post(BASE, { document });

    const res = await put(`${BASE}/booking-rules`, {
      document: { ...document, title: 'Booking rules v2' },
    });

    expect(await res.json()).toMatchObject({
      document: { id: 'booking-rules-v2' },
    });
    expect((await app.request(`${BASE}/booking-rules`)).status).toBe(404);
    expect((await app.request(`${BASE}/booking-rules-v2`)).status).toBe(200);
  });

  it('404s an update of a document the change does not have', async () => {
    const res = await put(`${BASE}/missing`, { document });

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'not_found' });
  });

  it('deletes a document, then 404s the second delete', async () => {
    await post(BASE, { document });

    expect(
      (await app.request(`${BASE}/booking-rules`, { method: 'DELETE' })).status,
    ).toBe(204);
    expect(
      (await app.request(`${BASE}/booking-rules`, { method: 'DELETE' })).status,
    ).toBe(404);
  });

  it('404s every route of a change that does not exist', async () => {
    const other = '/changes/nope/documents';

    expect((await app.request(other)).status).toBe(404);
    expect((await post(other, { document })).status).toBe(404);
    expect((await app.request(`${other}/booking-rules`)).status).toBe(404);
  });
});
