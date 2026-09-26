import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ChangeId } from '#backend/app/changes/change-id';
import type { SourceDocument } from '#backend/app/information-sources/source-document';
import { SourceDocumentId } from '#backend/app/information-sources/source-document-id';
import { type TestNoesis, testNoesis } from './test-noesis';

const CHANGE = ChangeId.parse('2026-01-01-booking');
const NOPE = ChangeId.parse('2026-01-01-nope');
const ID = SourceDocumentId.parse('2026-09-18-booking-rules-v2');

const document: SourceDocument = {
  id: ID,
  title: 'Booking Rules — v2',
  date: '2026-09-18',
  content: 'A slot may be booked once.',
};

let t: TestNoesis;

beforeEach(async () => {
  t = await testNoesis();
  await t.createChange(CHANGE);
});

afterEach(() => t.cleanup());

describe('source document queries', () => {
  it('lists oldest first, by id', async () => {
    for (const id of [
      '2026-09-10-newer',
      '2026-09-01-older',
      '2026-09-10-also-newer',
    ]) {
      await t.writeDocument(CHANGE, { ...document, id });
    }

    expect(
      (await t.listSourceDocumentsForChange.handle({ change: CHANGE })).map(
        (d) => d.id,
      ),
    ).toEqual([
      SourceDocumentId.parse('2026-09-01-older'),
      SourceDocumentId.parse('2026-09-10-also-newer'),
      SourceDocumentId.parse('2026-09-10-newer'),
    ]);
  });

  it('refuses a document that does not exist', async () => {
    await expect(
      t.findSourceDocumentById.handle({
        change: CHANGE,
        id: SourceDocumentId.parse('2026-01-01-missing'),
      }),
    ).rejects.toMatchObject({ entity: 'document' });
  });

  it('refuses every query on a change that has no directory', async () => {
    await expect(
      t.listSourceDocumentsForChange.handle({ change: NOPE }),
    ).rejects.toMatchObject({
      entity: 'change',
    });
    await expect(
      t.findSourceDocumentById.handle({ change: NOPE, id: ID }),
    ).rejects.toMatchObject({
      entity: 'change',
    });
  });
});
