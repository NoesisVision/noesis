import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ChangeId } from '#backend/app/changes/change-id';
import {
  type Document,
  DocumentContentSchema,
} from '#backend/app/information-sources/document';
import { DocumentId } from '#backend/app/information-sources/document-id';
import { type DocumentsService } from '#backend/app/information-sources/documents.service';
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
  it('lists oldest first, by id', async () => {
    for (const id of [
      '2026-09-10-newer',
      '2026-09-01-older',
      '2026-09-10-also-newer',
    ]) {
      await t.writeDocument(CHANGE, { ...document, id });
    }

    expect((await service.list(CHANGE)).map((d) => d.id)).toEqual([
      DocumentId.parse('2026-09-01-older'),
      DocumentId.parse('2026-09-10-also-newer'),
      DocumentId.parse('2026-09-10-newer'),
    ]);
  });

  it('refuses a document that does not exist', async () => {
    await expect(
      service.findById(CHANGE, DocumentId.parse('2026-01-01-missing')),
    ).rejects.toMatchObject({ entity: 'document' });
  });

  it('refuses every operation on a change that has no directory', async () => {
    await expect(service.list(NOPE)).rejects.toMatchObject({
      entity: 'change',
    });
    await expect(service.findById(NOPE, ID)).rejects.toMatchObject({
      entity: 'change',
    });
  });
});

describe('DocumentsService.create', () => {
  const content = DocumentContentSchema.parse({
    title: 'Booking Rules — v2',
    date: '2026-09-18',
    content: 'A slot may be booked once.',
  });

  it("mints the id from today's date and the title, not the document's date", async () => {
    const created = await service.create(CHANGE, content);

    const id = DocumentId.parse('2026-09-24-booking-rules-v2');
    expect(created).toEqual({ id, title: content.title, date: content.date });
    expect((await service.findById(CHANGE, id))?.document).toEqual({
      id,
      ...content,
    });
  });

  it('gives a title already used today in the change the next free suffix', async () => {
    await service.create(CHANGE, content);

    expect((await service.create(CHANGE, content)).id).toBe(
      DocumentId.parse('2026-09-24-booking-rules-v2-2'),
    );
  });

  it('mints the same id in another change', async () => {
    const other = await t.createChange('2026-01-01-billing');
    const first = await service.create(CHANGE, content);

    expect((await service.create(other, content)).id).toBe(first.id);
  });

  it('gives parallel creates of one title different ids', async () => {
    const created = await Promise.all([
      service.create(CHANGE, content),
      service.create(CHANGE, content),
    ]);

    expect(new Set(created.map((d) => d.id)).size).toBe(2);
    expect(await service.list(CHANGE)).toHaveLength(2);
  });

  it('refuses a change that has no directory', async () => {
    await expect(service.create(NOPE, content)).rejects.toMatchObject({
      entity: 'change',
    });
  });
});

describe('DocumentsService.update', () => {
  const content = DocumentContentSchema.parse({
    title: 'Booking rules',
    date: '2026-09-18',
    content: 'A slot may be booked once.',
  });

  it('replaces the document at its id, which a new title leaves as it was', async () => {
    const { id } = await service.create(CHANGE, content);

    const updated = await service.update(CHANGE, id, {
      ...content,
      title: 'Booking rules v3',
      content: 'A slot may be booked twice.',
    });

    expect(updated.id).toBe(id);
    const stored = await service.findById(CHANGE, id);
    expect(stored?.document.title).toBe('Booking rules v3');
    expect(stored?.document.content).toBe('A slot may be booked twice.');
    expect(await service.list(CHANGE)).toHaveLength(1);
  });

  it('refuses an id that names no document in the change, and creates nothing', async () => {
    const missing = DocumentId.parse('2026-09-24-missing');

    await expect(
      service.update(CHANGE, missing, content),
    ).rejects.toMatchObject({ entity: 'document' });
    expect(await service.list(CHANGE)).toEqual([]);
  });

  it('refuses a change that has no directory', async () => {
    await expect(service.update(NOPE, ID, content)).rejects.toMatchObject({
      entity: 'change',
    });
  });
});
