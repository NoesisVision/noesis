import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { NoesisChangesRepository } from '#backend/adapters/out/store/changes.repository';
import {
  type Change,
  ChangeContentSchema,
  NewChangeSchema,
} from '#backend/app/changes/change';
import { ChangeId } from '#backend/app/changes/change-id';
import { createChangeHandler } from '#backend/app/changes/create-change';
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

describe('Reading changes', () => {
  it('lets a tracker key repeat across changes', async () => {
    const draft = NewChangeSchema.parse({
      name: 'Payment retry',
      type: 'fix',
      key: 'NOE-1',
    });
    await t.createChange.handle(draft);
    await t.createChange.handle({ ...draft, name: 'Refund retry' });

    expect(await t.listChanges.handle()).toHaveLength(2);
  });

  it('lists newest first, by id', async () => {
    for (const id of ['2026-01-02-b', '2026-03-01-a', '2026-01-02-c']) {
      await t.changesRepository.create(change(id));
    }

    expect((await t.listChanges.handle()).map((c) => c.id)).toEqual([
      ChangeId.parse('2026-03-01-a'),
      ChangeId.parse('2026-01-02-c'),
      ChangeId.parse('2026-01-02-b'),
    ]);
  });

  it("names a change's design docs, then its documents, each oldest first", async () => {
    const id = await t.writeChange('2026-01-01-payment-retry');
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
      name: 'Retry flow',
    });

    const [listed] = await t.listChanges.handle();

    expect(
      listed?.entries.map(({ kind, id, name }) => `${kind} ${id} ${name}`),
    ).toEqual([
      'design-doc 2026-01-05-retry-flow Retry flow',
      'document 2026-01-02-interview Interview',
      'document 2026-01-03-notes Notes',
    ]);
  });

  it('lists every change, newest first, with its own entries', async () => {
    const older = await t.writeChange('2026-01-01-older');
    await t.writeChange('2026-01-02-newer');
    await t.writeDocument(older, {
      id: '2026-01-01-notes',
      title: 'Notes',
      date: '2026-01-01',
      content: '',
    });

    const listed = await t.listChanges.handle();

    expect(listed.map(({ id, entries }) => `${id} ${entries.length}`)).toEqual([
      '2026-01-02-newer 0',
      '2026-01-01-older 1',
    ]);
  });
});

describe('CreateChangeHandler', () => {
  const draft = NewChangeSchema.parse({ name: 'Payment retry', type: 'fix' });

  it("mints the id from today's date and the name, and starts in discovery", async () => {
    const created = await t.createChange.handle(draft);

    expect(created).toEqual({
      id: ChangeId.parse('2026-09-24-payment-retry'),
      name: 'Payment retry',
      key: '',
      type: 'fix',
      status: 'discovery',
      description: '',
    });
    expect(await t.findChange.handle({ id: created.id })).toEqual({
      ...created,
      designDocs: [],
      documents: [],
    });
  });

  it('gives a name already used today the next free suffix', async () => {
    await t.createChange.handle(draft);
    const second = await t.createChange.handle(draft);

    expect(second.id).toBe(ChangeId.parse('2026-09-24-payment-retry-2'));
    expect(await t.listChanges.handle()).toHaveLength(2);
  });

  it('gives parallel creates of one name different ids', async () => {
    const created = await Promise.all([
      t.createChange.handle(draft),
      t.createChange.handle(draft),
      t.createChange.handle(draft),
    ]);

    expect(created.map((c) => c.id)).toEqual([
      ChangeId.parse('2026-09-24-payment-retry'),
      ChangeId.parse('2026-09-24-payment-retry-2'),
      ChangeId.parse('2026-09-24-payment-retry-3'),
    ]);
  });

  it('gives creates of one name from two sessions different ids', async () => {
    // Another session's service over the same files, as its own process has.
    const otherSession = createChangeHandler(
      new NoesisChangesRepository(t.noesis),
      () => '2026-09-24',
    );

    const created = await Promise.all([
      t.createChange.handle(draft),
      otherSession.handle(draft),
      t.createChange.handle(draft),
      otherSession.handle(draft),
    ]);

    expect(new Set(created.map((c) => c.id)).size).toBe(4);
    expect(await t.listChanges.handle()).toHaveLength(4);
  });
});

describe('UpdateChangeHandler', () => {
  it('replaces the change at its id, which a rename leaves as it was', async () => {
    const { id } = await t.createChange.handle(
      NewChangeSchema.parse({ name: 'Payment retry', type: 'fix' }),
    );

    const updated = await t.updateChange.handle({
      id,
      ...ChangeContentSchema.parse({
        name: 'Payment retries',
        type: 'feature',
        status: 'design',
      }),
    });

    expect(updated.id).toBe(id);
    expect(await t.listChanges.handle()).toEqual([{ ...updated, entries: [] }]);
    expect(updated).toMatchObject({
      name: 'Payment retries',
      status: 'design',
    });
  });

  it('refuses an id that names no change, and creates nothing', async () => {
    const missing = ChangeId.parse('2026-09-24-missing');

    await expect(
      t.updateChange.handle({
        id: missing,
        ...ChangeContentSchema.parse({
          name: 'Missing',
          type: 'fix',
          status: 'design',
        }),
      }),
    ).rejects.toMatchObject({ entity: 'change' });
    expect(await t.listChanges.handle()).toEqual([]);
  });
});
