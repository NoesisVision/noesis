import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Change } from '#backend/app/changes/change';
import { createChangesApp } from '#backend/ui/changes/changes.routes';
import { decodedDesignDocFixture } from '../fixtures/design-doc.fixture';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;
let app: ReturnType<typeof createChangesApp>;

beforeEach(async () => {
  t = await testNoesis();
  app = createChangesApp({ changesService: t.changesService });
});

afterEach(() => t.cleanup());

const slugs = async () =>
  (await Array.fromAsync(t.changesRepository.keys())).map((s) => s.value);

const post = (body: unknown) =>
  app.request('/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const create = (name: string, key = '', type: Change['type'] = 'feature') =>
  t.changesService.create({ name, key, type });

describe('ui changes routes', () => {
  it('returns an empty navigation list when there are no changes', async () => {
    const response = await app.request('/navigation');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ changes: [] });
  });

  it('lists each change with the documents under it, scoped to it', async () => {
    const older = await t.createChange('older', { name: 'Older change' });
    await t.createChange('newer', {
      name: 'Newer change',
      created_at: '2026-09-14T00:00:00.000Z',
    });
    const designDoc = await t.designDocsService.create(
      older,
      decodedDesignDocFixture,
    );
    const document = await t.documentsService.create(older, {
      title: 'Stakeholder interview',
      date: '2026-09-12',
      content: 'What they said.',
    });

    const response = await app.request('/navigation');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      changes: [
        {
          slug: 'newer',
          name: 'Newer change',
          key: '',
          type: 'chore',
          status: 'discovery',
          created_at: '2026-09-14T00:00:00.000Z',
          description: '',
          documents: [],
          designDocs: [],
        },
        {
          slug: 'older',
          name: 'Older change',
          key: '',
          type: 'chore',
          status: 'discovery',
          created_at: '2026-09-13T00:00:00.000Z',
          description: '',
          documents: [{ id: document.id, name: document.title }],
          designDocs: [{ id: designDoc.id, name: designDoc.name }],
        },
      ],
    });
  });

  it('names the documents of a change in title order', async () => {
    const change = await t.createChange('older');
    for (const title of ['Zoning rules', 'Appointment booking', 'Glossary']) {
      await t.documentsService.create(change, {
        title,
        date: '2026-09-12',
        content: '',
      });
    }

    const response = await app.request('/navigation');
    const { changes } = (await response.json()) as {
      changes: { documents: { name: string }[] }[];
    };
    expect(changes[0]?.documents.map((d) => d.name)).toEqual([
      'Appointment booking',
      'Glossary',
      'Zoning rules',
    ]);
  });

  it('lists what the service created, whole', async () => {
    const change = await create('Payment retry', 'NOE-142');

    const listed = await app.request('/');
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual({ changes: [change] });
    expect(await slugs()).toEqual(['payment-retry']);
  });

  // Creation is the agent's, through the `create-change` tool.
  it('writes nothing: POST is not a route of this surface', async () => {
    const res = await post({ name: 'Payment retry', type: 'feature' });

    expect(res.status).toBe(404);
    expect(await slugs()).toEqual([]);
  });

  it('lists newest first', async () => {
    await t.changesService.create(
      { name: 'Older', key: '', type: 'chore' },
      new Date('2026-09-01T00:00:00Z'),
    );
    await t.changesService.create(
      { name: 'Newer', key: '', type: 'fix' },
      new Date('2026-09-02T00:00:00Z'),
    );
    const { changes } = (await (await app.request('/')).json()) as {
      changes: Change[];
    };
    expect(changes.map((c) => c.slug)).toEqual(['newer', 'older']);
  });

  it('reads one change by slug and 404s an unknown or unsafe one', async () => {
    await create('Audit log', '', 'improvement');
    const found = await app.request('/audit-log');
    expect(found.status).toBe(200);
    expect(((await found.json()) as { change: Change }).change.name).toBe(
      'Audit log',
    );

    const missing = await app.request('/nope');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'change_not_found' });
    expect((await app.request('/Not%20A%20Slug')).status).toBe(404);
  });
});
