import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ChangeId } from '#backend/app/changes/change-id';
import { ChangeNotFoundError } from '#backend/app/changes/changes.service';
import type { Document } from '#backend/app/information-sources/document';
import { DocumentId } from '#backend/app/information-sources/document-id';
import type { DocumentsService } from '#backend/app/information-sources/documents.service';
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
let service: DocumentsService;

beforeEach(async () => {
  t = await testNoesis();
  await t.createChange(CHANGE);
  service = t.documentsService;
});

afterEach(() => t.cleanup());

describe('DocumentsService', () => {
  it('stores a document under its id and reads it back whole', async () => {
    const added = await service.add(CHANGE, document);

    expect(added).toEqual({
      value: { id: ID, title: document.title, date: document.date },
      created: true,
    });
    expect((await service.findById(CHANGE, ID))?.document).toEqual(document);
  });

  it('updates the document at an id already in the change, whatever its title', async () => {
    await service.add(CHANGE, document);

    const updated = await service.add(CHANGE, {
      ...document,
      title: 'Booking rules v3',
      content: 'A slot may be booked twice.',
    });

    expect(updated.created).toBe(false);
    expect(updated.value.id).toBe(ID);
    const stored = await service.findById(CHANGE, ID);
    expect(stored?.document.title).toBe('Booking rules v3');
    expect(stored?.document.content).toBe('A slot may be booked twice.');
    expect((await service.list(CHANGE)).map((d) => d.id)).toEqual([ID]);
  });

  it('lets two documents share a title under different ids', async () => {
    const other = DocumentId.parse('2026-09-19-booking-rules-v2');
    await service.add(CHANGE, document);
    const added = await service.add(CHANGE, { ...document, id: other });

    expect(added.created).toBe(true);
    expect((await service.list(CHANGE)).map((d) => d.id)).toEqual([ID, other]);
  });

  it('answers created to only one of two parallel adds at one id', async () => {
    const results = await Promise.all([
      service.add(CHANGE, document),
      service.add(CHANGE, { ...document, content: 'Rewritten.' }),
    ]);

    expect(results.map((r) => r.created)).toEqual([true, false]);
    expect((await service.findById(CHANGE, ID))?.document.content).toBe(
      'Rewritten.',
    );
  });

  it('lets another change hold a document of the same id', async () => {
    const other = await t.createChange('2026-01-01-billing');
    await service.add(CHANGE, document);

    expect((await service.add(other, document)).created).toBe(true);
  });

  it('lists oldest first, by id', async () => {
    for (const id of [
      '2026-09-10-newer',
      '2026-09-01-older',
      '2026-09-10-also-newer',
    ]) {
      await service.add(CHANGE, { ...document, id: DocumentId.parse(id) });
    }

    expect((await service.list(CHANGE)).map((d) => d.id)).toEqual([
      DocumentId.parse('2026-09-01-older'),
      DocumentId.parse('2026-09-10-also-newer'),
      DocumentId.parse('2026-09-10-newer'),
    ]);
  });

  it('answers null for a document that does not exist', async () => {
    expect(
      await service.findById(CHANGE, DocumentId.parse('2026-01-01-missing')),
    ).toBe(null);
  });

  it('refuses every operation on a change that has no directory', async () => {
    await expect(service.list(NOPE)).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
    await expect(service.add(NOPE, document)).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
    await expect(service.findById(NOPE, ID)).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
  });
});
