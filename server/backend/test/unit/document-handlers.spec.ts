import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ChangeId } from '#backend/app/changes/change-id';
import {
  type Document,
  DocumentContentSchema,
} from '#backend/app/information-sources/document';
import { DocumentId } from '#backend/app/information-sources/document-id';
import { type TestNoesis, testNoesis } from './test-noesis';

const CHANGE = ChangeId.parse('2026-01-01-booking');
const NOPE = ChangeId.parse('2026-01-01-nope');
const ID = DocumentId.parse('2026-09-18-booking-rules-v2');

const document: Document = {
  id: ID,
  title: 'Booking Rules — v2',
  date: '2026-09-18',
  content: 'A slot may be booked once.',
};

let t: TestNoesis;

beforeEach(async () => {
  t = await testNoesis();
  await t.writeChange(CHANGE);
});

afterEach(() => t.cleanup());

describe('Reading the documents of a change', () => {
  it('lists oldest first, by id', async () => {
    for (const id of [
      '2026-09-10-newer',
      '2026-09-01-older',
      '2026-09-10-also-newer',
    ]) {
      await t.writeDocument(CHANGE, { ...document, id });
    }

    expect((await t.documentsIn(CHANGE)).map((d) => d.id)).toEqual([
      DocumentId.parse('2026-09-01-older'),
      DocumentId.parse('2026-09-10-also-newer'),
      DocumentId.parse('2026-09-10-newer'),
    ]);
  });

  it('refuses a document that does not exist', async () => {
    await expect(
      t.findDocument.handle({
        change: CHANGE,
        id: DocumentId.parse('2026-01-01-missing'),
      }),
    ).rejects.toMatchObject({ entity: 'document' });
  });

  it('refuses every operation on a change that has no directory', async () => {
    await expect(t.documentsIn(NOPE)).rejects.toMatchObject({
      entity: 'change',
    });
    await expect(
      t.findDocument.handle({ change: NOPE, id: ID }),
    ).rejects.toMatchObject({
      entity: 'change',
    });
  });
});

describe('CreateDocumentInChangeHandler', () => {
  const content = DocumentContentSchema.parse({
    title: 'Booking Rules — v2',
    date: '2026-09-18',
    content: 'A slot may be booked once.',
  });

  it("mints the id from today's date and the title, not the document's date", async () => {
    const created = await t.createDocumentInChange.handle({
      change: CHANGE,
      document: content,
    });

    const id = DocumentId.parse('2026-09-24-booking-rules-v2');
    expect(created).toEqual({ id, title: content.title, date: content.date });
    expect(await t.findDocument.handle({ change: CHANGE, id })).toEqual({
      id,
      ...content,
    });
  });

  it('gives a title already used today in the change the next free suffix', async () => {
    await t.createDocumentInChange.handle({
      change: CHANGE,
      document: content,
    });

    expect(
      (
        await t.createDocumentInChange.handle({
          change: CHANGE,
          document: content,
        })
      ).id,
    ).toBe(DocumentId.parse('2026-09-24-booking-rules-v2-2'));
  });

  it('mints the same id in another change', async () => {
    const other = await t.writeChange('2026-01-01-billing');
    const first = await t.createDocumentInChange.handle({
      change: CHANGE,
      document: content,
    });

    expect(
      (
        await t.createDocumentInChange.handle({
          change: other,
          document: content,
        })
      ).id,
    ).toBe(first.id);
  });

  it('gives parallel creates of one title different ids', async () => {
    const created = await Promise.all([
      t.createDocumentInChange.handle({ change: CHANGE, document: content }),
      t.createDocumentInChange.handle({ change: CHANGE, document: content }),
    ]);

    expect(new Set(created.map((d) => d.id)).size).toBe(2);
    expect(await t.documentsIn(CHANGE)).toHaveLength(2);
  });

  it('stores every one of many documents added to one change at once', async () => {
    const titles = ['Interview', 'Spec', 'Meeting notes', 'Research'];

    await Promise.all(
      titles.map((title) =>
        t.createDocumentInChange.handle({
          change: CHANGE,
          document: { ...content, title },
        }),
      ),
    );

    expect((await t.documentsIn(CHANGE)).map((d) => d.title).sort()).toEqual(
      titles.toSorted(),
    );
  });

  it('refuses a change that has no directory', async () => {
    await expect(
      t.createDocumentInChange.handle({ change: NOPE, document: content }),
    ).rejects.toMatchObject({
      entity: 'change',
    });
  });
});

describe('UpdateDocumentInChangeHandler', () => {
  const content = DocumentContentSchema.parse({
    title: 'Booking rules',
    date: '2026-09-18',
    content: 'A slot may be booked once.',
  });

  it('replaces the document at its id, which a new title leaves as it was', async () => {
    const { id } = await t.createDocumentInChange.handle({
      change: CHANGE,
      document: content,
    });

    const updated = await t.updateDocumentInChange.handle({
      change: CHANGE,
      id,
      document: {
        ...content,
        title: 'Booking rules v3',
        content: 'A slot may be booked twice.',
      },
    });

    expect(updated.id).toBe(id);
    const stored = await t.findDocument.handle({ change: CHANGE, id });
    expect(stored.title).toBe('Booking rules v3');
    expect(stored.content).toBe('A slot may be booked twice.');
    expect(await t.documentsIn(CHANGE)).toHaveLength(1);
  });

  it('refuses an id that names no document in the change, and creates nothing', async () => {
    const missing = DocumentId.parse('2026-09-24-missing');

    await expect(
      t.updateDocumentInChange.handle({
        change: CHANGE,
        id: missing,
        document: content,
      }),
    ).rejects.toMatchObject({ entity: 'document' });
    expect(await t.documentsIn(CHANGE)).toEqual([]);
  });

  it('refuses a change that has no directory', async () => {
    await expect(
      t.updateDocumentInChange.handle({
        change: NOPE,
        id: ID,
        document: content,
      }),
    ).rejects.toMatchObject({
      entity: 'change',
    });
  });
});

describe('DeleteDocumentFromChangeHandler', () => {
  it('removes the document, leaving the others of the change', async () => {
    const other = DocumentId.parse('2026-09-18-cancellation');
    await t.writeDocument(CHANGE, document);
    await t.writeDocument(CHANGE, { ...document, id: other });

    await t.deleteDocumentFromChange.handle({ change: CHANGE, id: ID });

    expect((await t.documentsIn(CHANGE)).map((d) => d.id)).toEqual([other]);
    await expect(
      t.findDocument.handle({ change: CHANGE, id: ID }),
    ).rejects.toMatchObject({
      entity: 'document',
    });
  });

  it('refuses an id that names no document in the change', async () => {
    await expect(
      t.deleteDocumentFromChange.handle({ change: CHANGE, id: ID }),
    ).rejects.toMatchObject({
      entity: 'document',
    });
  });

  it('refuses a change that does not exist', async () => {
    await expect(
      t.deleteDocumentFromChange.handle({ change: NOPE, id: ID }),
    ).rejects.toMatchObject({
      entity: 'change',
    });
  });

  it('never lets an update running beside it bring the document back', async () => {
    await t.writeDocument(CHANGE, document);
    const { id: _id, ...content } = document;

    const [removed] = await Promise.allSettled([
      t.deleteDocumentFromChange.handle({ change: CHANGE, id: ID }),
      t.updateDocumentInChange.handle({
        change: CHANGE,
        id: ID,
        document: content,
      }),
    ]);

    // The update lands before the removal or finds nothing: either way the
    // document stays removed.
    expect(removed.status).toBe('fulfilled');
    expect(await t.documentsIn(CHANGE)).toEqual([]);
  });
});
