import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Change } from '#backend/app/changes/change';
import { ChangeId } from '#backend/app/changes/change-id';
import { DocumentId } from '#backend/app/information-sources/document-id';
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

const ids = async (): Promise<string[]> =>
  Array.fromAsync(t.changesRepository.keys());

const post = (body: unknown) =>
  app.request('/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const add = async (
  id: string,
  name: string,
  key = '',
  type: Change['type'] = 'feature',
) =>
  (
    await t.changesService.add({
      id: ChangeId.parse(id),
      name,
      key,
      type,
      status: 'discovery',
      description: '',
    })
  ).value;

describe('ui changes routes', () => {
  it('returns an empty navigation list when there are no changes', async () => {
    const response = await app.request('/navigation');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ changes: [] });
  });

  it('lists each change with the documents under it, scoped to it', async () => {
    const older = await t.createChange('2026-09-13-older', {
      name: 'Older change',
    });
    await t.createChange('2026-09-14-newer', { name: 'Newer change' });
    const designDoc = (
      await t.designDocsService.add(older, decodedDesignDocFixture)
    ).value;
    const document = (
      await t.documentsService.add(older, {
        id: DocumentId.parse('2026-09-12-stakeholder-interview'),
        title: 'Stakeholder interview',
        date: '2026-09-12',
        content: 'What they said.',
      })
    ).value;

    const response = await app.request('/navigation');
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
          documents: [],
          designDocs: [],
        },
        {
          id: '2026-09-13-older',
          name: 'Older change',
          key: '',
          type: 'chore',
          status: 'discovery',
          description: '',
          documents: [{ id: document.id, name: document.title }],
          designDocs: [{ id: designDoc.id, name: designDoc.name }],
        },
      ],
    });
  });

  it('names the documents of a change oldest first, by id', async () => {
    const change = await t.createChange('2026-09-13-older');
    for (const [id, title] of [
      ['2026-09-12-zoning-rules', 'Zoning rules'],
      ['2026-09-10-appointment-booking', 'Appointment booking'],
      ['2026-09-11-glossary', 'Glossary'],
    ] as const) {
      await t.documentsService.add(change, {
        id: DocumentId.parse(id),
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

  it('lists what the service added, whole', async () => {
    const change = await add(
      '2026-09-01-payment-retry',
      'Payment retry',
      'NOE-142',
    );

    const listed = await app.request('/');
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual({ changes: [change] });
    expect(await ids()).toEqual(['2026-09-01-payment-retry']);
  });

  // Adding is the agent's, through the `add_change` tool.
  it('writes nothing: POST is not a route of this surface', async () => {
    const res = await post({ name: 'Payment retry', type: 'feature' });

    expect(res.status).toBe(404);
    expect(await ids()).toEqual([]);
  });

  it('lists newest first', async () => {
    await add('2026-09-01-older', 'Older', '', 'chore');
    await add('2026-09-02-newer', 'Newer', '', 'fix');
    const { changes } = (await (await app.request('/')).json()) as {
      changes: Change[];
    };
    expect(changes.map((c) => c.id)).toEqual([
      ChangeId.parse('2026-09-02-newer'),
      ChangeId.parse('2026-09-01-older'),
    ]);
  });

  it('reads one change by id and 404s an unknown or unsafe one', async () => {
    await add('2026-09-01-audit-log', 'Audit log', '', 'improvement');
    const found = await app.request('/2026-09-01-audit-log');
    expect(found.status).toBe(200);
    expect(((await found.json()) as { change: Change }).change.name).toBe(
      'Audit log',
    );

    const missing = await app.request('/2026-09-01-nope');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'change_not_found' });
    expect((await app.request('/audit-log')).status).toBe(404);
    expect((await app.request('/Not%20An%20Id')).status).toBe(404);
  });
});
