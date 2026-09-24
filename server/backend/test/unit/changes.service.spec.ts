import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Change } from '#backend/app/changes/change';
import { ChangeId } from '#backend/app/changes/change-id';
import { ChangeNotFoundError } from '#backend/app/changes/changes.service';
import { designDocFixture } from '../fixtures/design-doc.fixture';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;

beforeEach(async () => {
  t = await testNoesis();
});

afterEach(() => t.cleanup());

const change = (id: string, overrides: Partial<Change> = {}): Change => ({
  id: ChangeId.parse(id),
  name: 'Payment retry',
  key: '',
  type: 'fix',
  status: 'discovery',
  description: '',
  ...overrides,
});

describe('ChangesService', () => {
  it('creates a change at a new id and updates it at an existing one', async () => {
    const first = await t.changesService.add(
      change('2026-01-01-payment-retry'),
    );
    const second = await t.changesService.add(
      change('2026-01-01-payment-retry', {
        name: 'Payment retries',
        status: 'design',
      }),
    );

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(await t.changesService.list()).toEqual([second.value]);
    expect(second.value.name).toBe('Payment retries');
  });

  it('answers created to only one of two parallel adds at one id', async () => {
    const results = await Promise.all([
      t.changesService.add(change('2026-01-01-payment-retry')),
      t.changesService.add(
        change('2026-01-01-payment-retry', { type: 'chore' }),
      ),
    ]);

    expect(results.map((r) => r.created)).toEqual([true, false]);
    const [stored] = await t.changesService.list();
    expect(stored?.type).toBe('chore');
  });

  it('lets a tracker key repeat across changes', async () => {
    await t.changesService.add(change('2026-01-01-one', { key: 'NOE-1' }));
    await t.changesService.add(change('2026-01-02-two', { key: 'NOE-1' }));

    expect(await t.changesService.list()).toHaveLength(2);
  });

  it('lists newest first, by id', async () => {
    for (const id of ['2026-01-02-b', '2026-03-01-a', '2026-01-02-c']) {
      await t.changesService.add(change(id));
    }

    expect((await t.changesService.list()).map((c) => c.id)).toEqual([
      ChangeId.parse('2026-03-01-a'),
      ChangeId.parse('2026-01-02-c'),
      ChangeId.parse('2026-01-02-b'),
    ]);
  });

  it("names a change's design docs, then its documents, each oldest first", async () => {
    const id = await t.createChange('2026-01-01-payment-retry');
    await t.writeDocument(id, {
      id: '2026-01-03-notes',
      title: 'Notes',
      date: '2026-01-03',
      content: '',
    });
    await t.writeDocument(id, {
      id: '2026-01-02-interview',
      title: 'Interview',
      date: '2026-01-02',
      content: '',
    });
    await t.writeDesignDoc(id, {
      ...designDocFixture,
      id: '2026-01-05-retry-flow',
      name: { value: 'Retry flow' },
    });

    const entries = await t.changesService.entries(id);

    expect(
      entries.map(({ kind, id, name }) => `${kind} ${id} ${name}`),
    ).toEqual([
      'design-doc 2026-01-05-retry-flow Retry flow',
      'document 2026-01-02-interview Interview',
      'document 2026-01-03-notes Notes',
    ]);
  });

  it('refuses the entries of a change that does not exist', async () => {
    await expect(
      t.changesService.entries(ChangeId.parse('2026-01-01-missing')),
    ).rejects.toBeInstanceOf(ChangeNotFoundError);
  });

  it('lists every change, newest first, with its own entries', async () => {
    const older = await t.createChange('2026-01-01-older');
    await t.createChange('2026-01-02-newer');
    await t.writeDocument(older, {
      id: '2026-01-01-notes',
      title: 'Notes',
      date: '2026-01-01',
      content: '',
    });

    const listed = await t.changesService.listWithEntries();

    expect(listed.map(({ id, entries }) => `${id} ${entries.length}`)).toEqual([
      '2026-01-02-newer 0',
      '2026-01-01-older 1',
    ]);
  });
});
