import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ChangeId } from '#backend/app/changes/model/change-id';
import {
  CreateChange,
  UpdateChange,
} from '#backend/app/changes/model/change-snapshot';
import { CreateDesignDoc } from '#backend/app/changes/model/design-doc';
import { CreateSourceDocument } from '#backend/app/changes/model/source-document';
import { ConcurrentModificationError } from '#backend/app/concurrent-modification-error';
import { greenFieldDesignDocFixture } from '../fixtures/design-doc.fixture';
import { designDocId, sourceDocumentId } from '../fixtures/ids.fixture';
import { type TestNoesis, testNoesis } from './test-noesis';

// The test clock reads 2026-09-24.
const CHANGE = ChangeId.parse('2026-01-01-booking');
const NOPE = ChangeId.parse('2026-01-01-nope');

const { id: _id, ...greenField } = greenFieldDesignDocFixture;
const designDoc = CreateDesignDoc.parse(greenField);
const document = CreateSourceDocument.parse({
  title: 'Booking rules',
  date: '2026-09-18',
  content: 'A slot may be booked once.',
});
const draft = CreateChange.parse({ name: 'Payment retry', type: 'fix' });

let t: TestNoesis;

beforeEach(async () => {
  t = await testNoesis();
});

afterEach(() => t.cleanup());

describe('CreateChangeHandler', () => {
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
    expect(await t.stored(created.id)).toMatchObject({
      ...created,
      version: 1,
      designDocs: [],
      sourceDocuments: [],
    });
  });

  it('gives a name already used today the next free suffix', async () => {
    await t.createChange.handle(draft);
    const second = await t.createChange.handle(draft);

    expect(second.id).toBe(ChangeId.parse('2026-09-24-payment-retry-2'));
    expect(await t.listChanges.handle()).toHaveLength(2);
  });

  it('lets a tracker key repeat across changes', async () => {
    const keyed = { ...draft, key: 'NOE-1' };
    await t.createChange.handle(keyed);
    await t.createChange.handle({ ...keyed, name: 'Refund retry' });

    expect(await t.listChanges.handle()).toHaveLength(2);
  });

  it('refuses the second of two parallel creates that pick one id', async () => {
    const results = await Promise.allSettled([
      t.createChange.handle(draft),
      t.createChange.handle(draft),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    const refused = results.find((r) => r.status === 'rejected');
    expect(refused?.reason).toBeInstanceOf(ConcurrentModificationError);
    expect(await t.listChanges.handle()).toHaveLength(1);
  });
});

describe('UpdateChangeHandler', () => {
  it('replaces the change at its id, which a rename leaves as it was', async () => {
    await t.writeChange(CHANGE);
    await t.writeDocument(CHANGE, {
      id: sourceDocumentId(1),
      title: 'Notes',
      date: '2026-01-02',
      content: '',
    });

    const updated = await t.updateChange.handle({
      id: CHANGE,
      ...UpdateChange.parse({
        name: 'Payment retries',
        type: 'feature',
        status: 'design',
      }),
    });

    expect(updated).toMatchObject({
      id: CHANGE,
      name: 'Payment retries',
      status: 'design',
    });
    expect((await t.stored(CHANGE)).sourceDocuments).toHaveLength(1);
  });

  it('refuses an id that names no change, and creates nothing', async () => {
    await expect(
      t.updateChange.handle({
        id: NOPE,
        ...UpdateChange.parse({
          name: 'Missing',
          type: 'fix',
          status: 'design',
        }),
      }),
    ).rejects.toMatchObject({ entity: 'change' });
    expect(await t.listChanges.handle()).toEqual([]);
  });
});

describe('The handlers of what a change owns', () => {
  beforeEach(() => t.writeChange(CHANGE));

  it('store what they add in the change, answering its summary', async () => {
    const addedDesignDoc = await t.addDesignDocToChange.handle({
      change: CHANGE,
      designDoc,
    });
    const addedDocument = await t.addSourceDocumentToChange.handle({
      change: CHANGE,
      sourceDocument: document,
    });

    expect(addedDesignDoc).toEqual({
      id: expect.any(String),
      name: 'Partial refunds for orders',
      implemented: false,
    });
    expect(addedDocument).toEqual({
      id: expect.any(String),
      title: document.title,
      date: document.date,
    });
    expect(
      await t.findSourceDocument.handle({
        change: CHANGE,
        id: addedDocument.id,
      }),
    ).toEqual({ id: addedDocument.id, ...document });
    expect(
      (await t.findDesignDoc.handle({ change: CHANGE, id: addedDesignDoc.id }))
        .name,
    ).toBe('Partial refunds for orders');
  });

  it('store what they revise in the change', async () => {
    const { id } = await t.addSourceDocumentToChange.handle({
      change: CHANGE,
      sourceDocument: document,
    });
    const designDocAdded = (
      await t.addDesignDocToChange.handle({ change: CHANGE, designDoc })
    ).id;

    await t.updateSourceDocumentInChange.handle({
      change: CHANGE,
      id,
      sourceDocument: { ...document, content: 'Twice.' },
    });
    await t.updateDesignDocInChange.handle({
      change: CHANGE,
      id: designDocAdded,
      designDoc: { ...designDoc, implemented: true },
    });

    const stored = await t.stored(CHANGE);
    expect(stored.sourceDocuments.map((d) => d.content)).toEqual(['Twice.']);
    expect(stored.designDocs.map((d) => d.implemented)).toEqual([true]);
    expect(stored.version).toBe(5);
  });

  it('refuse a change that does not exist, whatever they do', async () => {
    const designDocMissing = designDocId(99);
    const documentId = sourceDocumentId(99);
    for (const call of [
      () => t.addDesignDocToChange.handle({ change: NOPE, designDoc }),
      () =>
        t.updateDesignDocInChange.handle({
          change: NOPE,
          id: designDocMissing,
          designDoc,
        }),
      () => t.findDesignDoc.handle({ change: NOPE, id: designDocMissing }),
      () =>
        t.addSourceDocumentToChange.handle({
          change: NOPE,
          sourceDocument: document,
        }),
      () =>
        t.updateSourceDocumentInChange.handle({
          change: NOPE,
          id: documentId,
          sourceDocument: document,
        }),
      () => t.findSourceDocument.handle({ change: NOPE, id: documentId }),
      () => t.findChange.handle({ id: NOPE }),
    ]) {
      await expect(call()).rejects.toMatchObject({ entity: 'change' });
    }
  });

  it('refuse the second of two parallel adds, keeping the first', async () => {
    const results = await Promise.allSettled([
      t.addSourceDocumentToChange.handle({
        change: CHANGE,
        sourceDocument: document,
      }),
      t.addSourceDocumentToChange.handle({
        change: CHANGE,
        sourceDocument: document,
      }),
    ]);

    const refused = results.filter((r) => r.status === 'rejected');
    expect(refused).toHaveLength(1);
    expect(refused[0]?.reason).toBeInstanceOf(ConcurrentModificationError);
    expect((await t.stored(CHANGE)).sourceDocuments).toHaveLength(1);
  });
});

describe('ListChangesHandler', () => {
  it('lists every change newest first, each with its own entries', async () => {
    const older = await t.writeChange('2026-01-01-older');
    await t.writeChange('2026-01-02-newer');
    await t.writeDocument(older, {
      id: sourceDocumentId(1),
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

describe('FindChangeHandler', () => {
  it('answers the change with what it owns summarised', async () => {
    await t.writeChange(CHANGE, { name: 'Booking' });
    const addedDocument = await t.addSourceDocumentToChange.handle({
      change: CHANGE,
      sourceDocument: document,
    });
    const addedDesignDoc = await t.addDesignDocToChange.handle({
      change: CHANGE,
      designDoc,
    });

    expect(await t.findChange.handle({ id: CHANGE })).toEqual({
      id: CHANGE,
      name: 'Booking',
      key: '',
      type: 'chore',
      status: 'discovery',
      description: '',
      designDocs: [
        {
          id: addedDesignDoc.id,
          name: 'Partial refunds for orders',
          implemented: false,
        },
      ],
      sourceDocuments: [
        {
          id: addedDocument.id,
          title: document.title,
          date: document.date,
        },
      ],
    });
  });
});
