import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createUiApp } from '#backend/adapters/in/ui/ui.routes';
import { ConcurrentModificationError } from '#backend/app/changes/concurrent-modification-error';
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

describe('ui changes routes', () => {
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

  it('writes nothing a change owns: POST under a change is not a route', async () => {
    const change = await t.writeChange('2026-09-01-audit-log');
    for (const path of ['design-docs', 'source-documents']) {
      const res = await app.request(`/changes/${change}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      expect(res.status).toBe(404);
    }
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
    expect(await missing.json()).toEqual({ error: 'change_not_found' });
    for (const malformed of ['audit-log', 'Not%20An%20Id']) {
      const res = await app.request(`/changes/${malformed}`);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'change_not_found' });
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
    expect(await res.json()).toEqual({ error: 'conflict' });
  });
});
