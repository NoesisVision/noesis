import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Change } from '#backend/app/changes/change';
import { ChangeId } from '#backend/app/changes/change-id';
import { DocumentId } from '#backend/app/information-sources/document-id';
import { SearchService } from '#backend/app/search/search.service';
import { createUiApp } from '#backend/ui/ui.routes';
import {
  decodedDesignDocFixture,
  designDocFixture,
} from '../fixtures/design-doc.fixture';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;
let app: ReturnType<typeof createUiApp>;

beforeEach(async () => {
  t = await testNoesis();
  // Through the whole surface: its error handler answers a missing change.
  app = createUiApp({
    searchService: new SearchService(),
    changesService: t.changesService,
    designDocsService: t.designDocsService,
    documentsService: t.documentsService,
  });
});

afterEach(() => t.cleanup());

const ids = async (): Promise<string[]> =>
  (await t.changesRepository.list()).map(({ id }) => id);

const post = (body: unknown) =>
  app.request('/changes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

/** Writes a change as the agent's tools leave it, bypassing the service. */
const add = async (
  id: string,
  name: string,
  key = '',
  type: Change['type'] = 'feature',
): Promise<Change> => {
  const change: Change = {
    id: ChangeId.parse(id),
    name,
    key,
    type,
    status: 'discovery',
    description: '',
  };
  await t.changesRepository.save(change);
  return change;
};

describe('ui changes routes', () => {
  it('returns an empty list when there are no changes', async () => {
    const response = await app.request('/changes/navigation');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ changes: [] });
  });

  it('lists each change with its entries, scoped to it', async () => {
    const older = await t.createChange('2026-09-13-older', {
      name: 'Older change',
    });
    await t.createChange('2026-09-14-newer', { name: 'Newer change' });
    await t.writeDesignDoc(older, designDocFixture);
    const document = {
      id: DocumentId.parse('2026-09-12-stakeholder-interview'),
      title: 'Stakeholder interview',
      date: '2026-09-12',
      content: 'What they said.',
    };
    await t.writeDocument(older, document);

    const response = await app.request('/changes/navigation');
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
          key: '',
          type: 'chore',
          status: 'discovery',
          description: '',
          entries: [
            {
              kind: 'design-doc',
              id: decodedDesignDocFixture.id,
              name: decodedDesignDocFixture.name,
            },
            { kind: 'document', id: document.id, name: document.title },
          ],
        },
      ],
    });
  });

  it('names the entries of a change oldest first, by id', async () => {
    const change = await t.createChange('2026-09-13-older');
    for (const [id, title] of [
      ['2026-09-12-zoning-rules', 'Zoning rules'],
      ['2026-09-10-appointment-booking', 'Appointment booking'],
      ['2026-09-11-glossary', 'Glossary'],
    ] as const) {
      await t.writeDocument(change, {
        id,
        title,
        date: '2026-09-12',
        content: '',
      });
    }

    const response = await app.request('/changes/navigation');
    const { changes } = (await response.json()) as {
      changes: { entries: { name: string }[] }[];
    };
    expect(changes[0]?.entries.map((entry) => entry.name)).toEqual([
      'Appointment booking',
      'Glossary',
      'Zoning rules',
    ]);
  });

  it('lists what is stored, whole', async () => {
    const change = await add(
      '2026-09-01-payment-retry',
      'Payment retry',
      'NOE-142',
    );

    const listed = await app.request('/changes');
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual({ changes: [change] });
    expect(await ids()).toEqual(['2026-09-01-payment-retry']);
  });

  // Creating is the agent's, through the `create_change` tool.
  it('writes nothing: POST is not a route of this surface', async () => {
    const res = await post({ name: 'Payment retry', type: 'feature' });

    expect(res.status).toBe(404);
    expect(await ids()).toEqual([]);
  });

  it('lists newest first', async () => {
    await add('2026-09-01-older', 'Older', '', 'chore');
    await add('2026-09-02-newer', 'Newer', '', 'fix');
    const { changes } = (await (await app.request('/changes')).json()) as {
      changes: Change[];
    };
    expect(changes.map((c) => c.id)).toEqual([
      ChangeId.parse('2026-09-02-newer'),
      ChangeId.parse('2026-09-01-older'),
    ]);
  });

  it('reads one change by id and 404s an unknown or unsafe one', async () => {
    await add('2026-09-01-audit-log', 'Audit log', '', 'improvement');
    const found = await app.request('/changes/2026-09-01-audit-log');
    expect(found.status).toBe(200);
    expect(((await found.json()) as { change: Change }).change.name).toBe(
      'Audit log',
    );

    const missing = await app.request('/changes/2026-09-01-nope');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'change_not_found' });
    for (const malformed of ['audit-log', 'Not%20An%20Id']) {
      const res = await app.request(`/changes/${malformed}`);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'change_not_found' });
    }
  });
});
