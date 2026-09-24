import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { ChangeId } from '#backend/app/changes/change-id';
import type { Document } from '#backend/app/information-sources/document';
import { DocumentId } from '#backend/app/information-sources/document-id';
import { SearchService } from '#backend/app/search/search.service';
import { createUiApp } from '#backend/ui/ui.routes';
import { type TestNoesis, testNoesis } from './test-noesis';

// Through the ui app rather than the sub-app alone: the change comes from the
// mount path (`/changes/:change/documents`), which is what is under test.
// The surface only reads; documents get in through the MCP tools, so the
// tests seed them through the service.

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
  change = await t.createChange(CHANGE);
  app = createUiApp({
    searchService: new SearchService(),
    changesService: t.changesService,
    designDocsService: t.designDocsService,
    documentsService: t.documentsService,
  });
});

afterEach(() => t.cleanup());

describe('ui documents routes', () => {
  it('lists the stored documents of the change', async () => {
    await t.writeDocument(change, document);

    const listed = await app.request(BASE);
    expect(listed.status).toBe(200);
    const { documents } = (await listed.json()) as {
      documents: { id: string }[];
    };
    expect(documents.map((d) => d.id)).toEqual([ID]);
  });

  it('serves a stored document whole, and 404s a missing one', async () => {
    await t.writeDocument(change, document);

    const res = await app.request(`${BASE}/${ID}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      summary: { id: ID },
      document: { content: 'A slot may be booked once.' },
    });

    expect((await app.request(`${BASE}/2026-09-18-missing`)).status).toBe(404);
    expect((await app.request(`${BASE}/Not_An_Id`)).status).toBe(404);
    expect((await app.request(`${BASE}/booking-rules`)).status).toBe(404);
  });

  // Adding, revising and removing are the agent's, through the MCP tools.
  it('writes nothing: POST, PUT and DELETE are not routes of this surface', async () => {
    await t.writeDocument(change, document);
    const send = (method: string, path: string) =>
      app.request(path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ document }),
      });

    expect((await send('POST', BASE)).status).toBe(404);
    expect((await send('PUT', `${BASE}/${ID}`)).status).toBe(404);
    expect((await send('DELETE', `${BASE}/${ID}`)).status).toBe(404);
    expect((await t.documentsService.list(change)).map((d) => d.id)).toEqual([
      DocumentId.parse(ID),
    ]);
  });

  it('404s every route of a change that does not exist', async () => {
    const other = '/changes/2026-01-01-nope/documents';

    expect((await app.request(other)).status).toBe(404);
    expect((await app.request(`${other}/${ID}`)).status).toBe(404);
  });
});
