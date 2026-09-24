import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  type Change,
  ChangeContentSchema,
  NewChangeSchema,
} from '#backend/app/changes/change';
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
  it('lets a tracker key repeat across changes', async () => {
    const draft = NewChangeSchema.parse({
      name: 'Payment retry',
      type: 'fix',
      key: 'NOE-1',
    });
    await t.changesService.create(draft);
    await t.changesService.create({ ...draft, name: 'Refund retry' });

    expect(await t.changesService.list()).toHaveLength(2);
  });

  it('lists newest first, by id', async () => {
    for (const id of ['2026-01-02-b', '2026-03-01-a', '2026-01-02-c']) {
      await t.changesRepository.save(change(id));
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

describe('ChangesService.create', () => {
  const draft = NewChangeSchema.parse({ name: 'Payment retry', type: 'fix' });

  it("mints the id from today's date and the name, and starts in discovery", async () => {
    const created = await t.changesService.create(draft);

    expect(created).toEqual({
      id: ChangeId.parse('2026-09-24-payment-retry'),
      name: 'Payment retry',
      key: '',
      type: 'fix',
      status: 'discovery',
      description: '',
    });
    expect(await t.changesService.findById(created.id)).toEqual(created);
  });

  it('gives a name already used today the next free suffix', async () => {
    await t.changesService.create(draft);
    const second = await t.changesService.create(draft);

    expect(second.id).toBe(ChangeId.parse('2026-09-24-payment-retry-2'));
    expect(await t.changesService.list()).toHaveLength(2);
  });

  it('gives parallel creates of one name different ids', async () => {
    const created = await Promise.all([
      t.changesService.create(draft),
      t.changesService.create(draft),
      t.changesService.create(draft),
    ]);

    expect(created.map((c) => c.id)).toEqual([
      ChangeId.parse('2026-09-24-payment-retry'),
      ChangeId.parse('2026-09-24-payment-retry-2'),
      ChangeId.parse('2026-09-24-payment-retry-3'),
    ]);
  });
});

describe('ChangesService.update', () => {
  it('replaces the change at its id, which a rename leaves as it was', async () => {
    const { id } = await t.changesService.create(
      NewChangeSchema.parse({ name: 'Payment retry', type: 'fix' }),
    );

    const updated = await t.changesService.update(
      id,
      ChangeContentSchema.parse({
        name: 'Payment retries',
        type: 'feature',
        status: 'design',
      }),
    );

    expect(updated.id).toBe(id);
    expect(await t.changesService.list()).toEqual([updated]);
    expect(updated).toMatchObject({
      name: 'Payment retries',
      status: 'design',
    });
  });

  it('refuses an id that names no change, and creates nothing', async () => {
    const missing = ChangeId.parse('2026-09-24-missing');

    await expect(
      t.changesService.update(
        missing,
        ChangeContentSchema.parse({ name: 'Missing', type: 'fix' }),
      ),
    ).rejects.toBeInstanceOf(ChangeNotFoundError);
    expect(await t.changesService.list()).toEqual([]);
  });
});
