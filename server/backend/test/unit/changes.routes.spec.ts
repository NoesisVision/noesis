import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createUiApp } from '#backend/adapters/in/ui/ui.routes';
import { ConcurrentModificationError } from '#backend/app/changes/concurrent-modification-error';
import { MAX_WORKING_FILE_BYTES } from '#backend/platform/files/working-file-limit';
import {
  decodedDesignDocFixture,
  designDocFixture,
} from '../fixtures/design-doc.fixture';
import { sourceDocumentId } from '../fixtures/ids.fixture';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;
let app: ReturnType<typeof createUiApp>;

beforeEach(async () => {
  t = await testNoesis();
  // Through the whole surface: its error handler answers a missing change.
  app = createUiApp(t);
});

afterEach(() => t.cleanup());

const ids = async (): Promise<string[]> =>
  (await t.changesRepository.list()).map(({ id }) => id);

const document = {
  id: sourceDocumentId(1),
  title: 'Stakeholder interview',
  date: '2026-09-12',
  content: 'What they said.',
};

const post = (body: unknown) =>
  app.request('/changes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const patch = (id: string, body: unknown) =>
  app.request(`/changes/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('ui changes routes', () => {
  it('answers a body that is not JSON with 400, never 500', async () => {
    for (const body of ['{', '']) {
      const response = await app.request('/changes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'invalid_body' });
    }
  });

  it('returns an empty list when there are no changes', async () => {
    const response = await app.request('/changes');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ changes: [] });
  });

  it('lists each change newest first, with its entries, scoped to it', async () => {
    const older = await t.writeChange('2026-09-13-older', {
      name: 'Older change',
      key: 'NOE-142',
    });
    await t.writeChange('2026-09-14-newer', { name: 'Newer change' });
    await t.writeDesignDoc(older, designDocFixture);
    await t.writeDocument(older, document);

    const response = await app.request('/changes');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      changes: [
        {
          id: '2026-09-14-newer',
          name: 'Newer change',
          key: '',
          type: 'chore',
          status: 'discovery',
          description: '',
          entries: [],
        },
        {
          id: '2026-09-13-older',
          name: 'Older change',
          key: 'NOE-142',
          type: 'chore',
          status: 'discovery',
          description: '',
          entries: [
            {
              kind: 'design-doc',
              id: decodedDesignDocFixture.id,
              name: decodedDesignDocFixture.name,
              implemented: false,
            },
            {
              kind: 'source-document',
              id: document.id,
              title: document.title,
              date: document.date,
            },
          ],
        },
      ],
    });
  });

  it('names the entries of a change in the order they were added', async () => {
    const change = await t.writeChange('2026-09-13-older');
    for (const [id, title] of [
      [sourceDocumentId(3), 'Zoning rules'],
      [sourceDocumentId(1), 'Appointment booking'],
      [sourceDocumentId(2), 'Glossary'],
    ] as const) {
      await t.writeDocument(change, {
        id,
        title,
        date: '2026-09-12',
        content: '',
      });
    }

    const response = await app.request('/changes');
    const { changes } = (await response.json()) as {
      changes: { entries: { title: string }[] }[];
    };
    expect(changes[0]?.entries.map((entry) => entry.title)).toEqual([
      'Zoning rules',
      'Appointment booking',
      'Glossary',
    ]);
  });

  it("creates a change at an id minted from today's date and its name, in discovery", async () => {
    const res = await post({
      name: 'Payment retry',
      type: 'feature',
      key: 'NOE-142',
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      change: {
        id: '2026-09-24-payment-retry',
        name: 'Payment retry',
        key: 'NOE-142',
        type: 'feature',
        status: 'discovery',
        description: '',
      },
    });
    expect(await ids()).toEqual(['2026-09-24-payment-retry']);
  });

  it('refuses a body that is not a change, creating nothing', async () => {
    const res = await post({ name: 'Payment retry', type: 'feat' });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_body' });
    expect(await ids()).toEqual([]);
  });

  it('updates what a change says of itself, at its id', async () => {
    const change = await t.writeChange('2026-09-01-audit-log');

    const res = await patch(change, {
      name: 'Audit trail',
      key: 'NOE-7',
      type: 'feature',
      status: 'design',
      description: 'Who did what.',
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      change: {
        id: change,
        name: 'Audit trail',
        key: 'NOE-7',
        type: 'feature',
        status: 'design',
        description: 'Who did what.',
      },
    });
    expect((await t.stored(change)).version).toBe(2);
  });

  it('refuses an update without a status, or of an unknown change', async () => {
    const change = await t.writeChange('2026-09-01-audit-log');

    const invalid = await patch(change, { name: 'Audit', type: 'chore' });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: 'invalid_body' });

    const unknown = await patch('2026-09-01-nope', {
      name: 'Audit',
      type: 'chore',
      status: 'design',
    });
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({ error: 'change_not_found' });
    expect((await t.stored(change)).version).toBe(1);
  });

  it('refuses a body larger than a working file, creating nothing', async () => {
    const res = await post({
      name: 'Payment retry',
      type: 'feature',
      description: 'x'.repeat(MAX_WORKING_FILE_BYTES + 1),
    });

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      error: 'payload_too_large',
      limit: MAX_WORKING_FILE_BYTES,
    });
    expect(await ids()).toEqual([]);
  });

  it('reads one change with what it owns summarised', async () => {
    const change = await t.writeChange('2026-09-01-audit-log', {
      name: 'Audit log',
      type: 'improvement',
    });
    await t.writeDesignDoc(change, designDocFixture);
    await t.writeDocument(change, document);

    const found = await app.request('/changes/2026-09-01-audit-log');

    expect(found.status).toBe(200);
    expect(await found.json()).toEqual({
      change: {
        id: '2026-09-01-audit-log',
        name: 'Audit log',
        key: '',
        type: 'improvement',
        status: 'discovery',
        description: '',
        designDocs: [
          {
            id: decodedDesignDocFixture.id,
            name: decodedDesignDocFixture.name,
            implemented: false,
          },
        ],
        sourceDocuments: [
          { id: document.id, title: document.title, date: document.date },
        ],
      },
    });
  });

  it('404s an unknown or unsafe change id', async () => {
    const missing = await app.request('/changes/2026-09-01-nope');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      error: 'change_not_found',
      entity: 'change',
      id: '2026-09-01-nope',
    });
    for (const malformed of ['audit-log', 'Not An Id']) {
      const res = await app.request(
        `/changes/${encodeURIComponent(malformed)}`,
      );
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        error: 'change_not_found',
        entity: 'change',
        id: malformed,
      });
    }
  });

  it('answers a write that lost a race with 409', async () => {
    const raced = await t.writeChange('2026-09-01-raced');
    const res = await createUiApp({
      ...t,
      listChanges: {
        handle: () => Promise.reject(new ConcurrentModificationError(raced)),
      },
    }).request('/changes');

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'conflict', change: raced });
  });
});
