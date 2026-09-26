import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ChangeId } from '#backend/app/changes/change-id';
import { CreateSourceDocument } from '#backend/app/information-sources/create-source-document';
import { SourceDocumentId } from '#backend/app/information-sources/source-document-id';
import { UpdateSourceDocument } from '#backend/app/information-sources/update-source-document';
import { type TestNoesis, testNoesis } from './test-noesis';

const CHANGE = ChangeId.parse('2026-01-01-booking');
const NOPE = ChangeId.parse('2026-01-01-nope');
const ID = SourceDocumentId.parse('2026-09-18-booking-rules-v2');

let t: TestNoesis;

beforeEach(async () => {
  t = await testNoesis();
  await t.createChange(CHANGE);
});

afterEach(() => t.cleanup());

describe('CreateSourceDocumentHandler', () => {
  const content = CreateSourceDocument.shape.document.parse({
    title: 'Booking Rules — v2',
    date: '2026-09-18',
    content: 'A slot may be booked once.',
  });

  it("mints the id from today's date and the title, not the document's date", async () => {
    const created = await t.createSourceDocument.handle({
      change: CHANGE,
      document: content,
    });

    const id = SourceDocumentId.parse('2026-09-24-booking-rules-v2');
    expect(created).toEqual({ id, title: content.title, date: content.date });
    expect(
      await t.findSourceDocumentById.handle({ change: CHANGE, id: id }),
    ).toEqual({
      id,
      ...content,
    });
  });

  it('gives a title already used today in the change the next free suffix', async () => {
    await t.createSourceDocument.handle({ change: CHANGE, document: content });

    expect(
      (
        await t.createSourceDocument.handle({
          change: CHANGE,
          document: content,
        })
      ).id,
    ).toBe(SourceDocumentId.parse('2026-09-24-booking-rules-v2-2'));
  });

  it('mints the same id in another change', async () => {
    const other = await t.createChange('2026-01-01-billing');
    const first = await t.createSourceDocument.handle({
      change: CHANGE,
      document: content,
    });

    expect(
      (
        await t.createSourceDocument.handle({
          change: other,
          document: content,
        })
      ).id,
    ).toBe(first.id);
  });

  it('gives parallel creates of one title different ids', async () => {
    const created = await Promise.all([
      t.createSourceDocument.handle({ change: CHANGE, document: content }),
      t.createSourceDocument.handle({ change: CHANGE, document: content }),
    ]);

    expect(new Set(created.map((d) => d.id)).size).toBe(2);
    expect(
      await t.listSourceDocumentsForChange.handle({ change: CHANGE }),
    ).toHaveLength(2);
  });

  it('refuses a change that has no directory', async () => {
    await expect(
      t.createSourceDocument.handle({ change: NOPE, document: content }),
    ).rejects.toMatchObject({
      entity: 'change',
    });
  });
});

describe('UpdateSourceDocumentHandler', () => {
  const content = UpdateSourceDocument.shape.document.parse({
    title: 'Booking rules',
    date: '2026-09-18',
    content: 'A slot may be booked once.',
  });

  it('replaces the document at its id, which a new title leaves as it was', async () => {
    const { id } = await t.createSourceDocument.handle({
      change: CHANGE,
      document: content,
    });

    const updated = await t.updateSourceDocument.handle({
      change: CHANGE,
      id,
      document: {
        ...content,
        title: 'Booking rules v3',
        content: 'A slot may be booked twice.',
      },
    });

    expect(updated.id).toBe(id);
    const stored = await t.findSourceDocumentById.handle({
      change: CHANGE,
      id,
    });
    expect(stored.title).toBe('Booking rules v3');
    expect(stored.content).toBe('A slot may be booked twice.');
    expect(
      await t.listSourceDocumentsForChange.handle({ change: CHANGE }),
    ).toHaveLength(1);
  });

  it('refuses an id that names no document in the change, and creates nothing', async () => {
    const missing = SourceDocumentId.parse('2026-09-24-missing');

    await expect(
      t.updateSourceDocument.handle({
        change: CHANGE,
        id: missing,
        document: content,
      }),
    ).rejects.toMatchObject({ entity: 'document' });
    expect(
      await t.listSourceDocumentsForChange.handle({ change: CHANGE }),
    ).toEqual([]);
  });

  it('refuses a change that has no directory', async () => {
    await expect(
      t.updateSourceDocument.handle({
        change: NOPE,
        id: ID,
        document: content,
      }),
    ).rejects.toMatchObject({
      entity: 'change',
    });
  });
});
