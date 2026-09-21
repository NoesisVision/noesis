import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Change } from '#backend/app/changes/change';
import { designDocFixture } from '#backend/app/design-docs/design-doc.fixture';
import { createChangesApp } from '#backend/ui/changes/changes.routes';
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

describe('ui changes routes', () => {
  it('returns an empty navigation list when there are no changes', async () => {
    const response = await app.request('/navigation');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ changes: [] });
  });

  it('lists each change with its design documents, scoped to it', async () => {
    const older = await t.createChange('older', { name: 'Older change' });
    await t.createChange('newer', {
      name: 'Newer change',
      created_at: '2026-09-14T00:00:00.000Z',
    });
    const document = await t.designDocsService.create(older, designDocFixture);

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
          designDocs: [{ id: document.id, name: document.name }],
        },
      ],
    });
  });

  it('creates a change from its name, writes its data.json and lists it', async () => {
    const created = await post({
      name: 'Payment retry',
      key: 'NOE-142',
      type: 'feature',
    });
    expect(created.status).toBe(201);
    const { change } = (await created.json()) as { change: Change };
    expect(change).toMatchObject({
      slug: 'payment-retry',
      name: 'Payment retry',
      key: 'NOE-142',
      type: 'feature',
      status: 'discovery',
      description: '',
    });
    expect(Date.parse(change.created_at)).not.toBeNaN();

    const listed = await app.request('/');
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual({ changes: [change] });
    expect(await slugs()).toEqual(['payment-retry']);
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
    await post({ name: 'Audit log', type: 'improvement' });
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

  it('409s a taken slug or key, naming the field, and 400s a bad body', async () => {
    await post({ name: 'Once', key: 'NOE-1', type: 'fix' });

    const sameSlug = await post({ name: 'once', key: 'NOE-2', type: 'fix' });
    expect(sameSlug.status).toBe(409);
    expect(await sameSlug.json()).toEqual({
      error: 'duplicate_change',
      field: 'slug',
    });

    const sameKey = await post({ name: 'Other', key: 'NOE-1', type: 'fix' });
    expect(sameKey.status).toBe(409);
    expect(await sameKey.json()).toEqual({
      error: 'duplicate_change',
      field: 'key',
    });
    expect(await slugs()).toEqual(['once']);

    expect((await post({ name: '', type: 'fix' })).status).toBe(400);
    expect((await post({ name: 'x', type: 'feat' })).status).toBe(400);
    expect((await post({ name: 'x', key: 'bad', type: 'fix' })).status).toBe(
      400,
    );

    // The envelope check names the offending fields.
    const empty = await post({});
    expect(empty.status).toBe(400);
    const body = (await empty.json()) as {
      error: string;
      issues: { fieldErrors: Record<string, string[]> };
    };
    expect(body.error).toBe('invalid_body');
    expect(Object.keys(body.issues.fieldErrors)).toContain('name');
  });
});
