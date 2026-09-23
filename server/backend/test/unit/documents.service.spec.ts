import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import { ChangeNotFoundError } from '#backend/app/changes/changes.service';
import type { CreateDocument } from '#backend/app/information-sources/document';
import { DocumentId } from '#backend/app/information-sources/document-id';
import {
  DocumentNotFoundError,
  type DocumentsService,
  DuplicateDocumentError,
} from '#backend/app/information-sources/documents.service';
import { type TestNoesis, testNoesis } from './test-noesis';

const CHANGE = ChangeSlug.parse('booking');
const NOPE = ChangeSlug.parse('nope');

const document: CreateDocument = {
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
  it('stores a document under the slug of its title and reads it back whole', async () => {
    const summary = await service.create(CHANGE, document);

    expect(summary.id).toBe(DocumentId.parse('booking-rules-v2'));
    expect(summary.path).toEndWith(
      '/graph/changes/booking/documents/booking-rules-v2/data.json',
    );

    const detail = await service.findById(CHANGE, DocumentId.parse(summary.id));
    expect(detail?.document).toEqual({
      ...document,
      document_id: DocumentId.parse('booking-rules-v2'),
    });
  });

  it('refuses a title no id can be derived from, on create and on retitle', async () => {
    expect(
      service.create(CHANGE, { ...document, title: '!!!' }),
    ).rejects.toBeInstanceOf(z.ZodError);

    const created = await service.create(CHANGE, document);
    expect(
      service.update(CHANGE, DocumentId.parse(created.id), {
        ...document,
        title: '日本語',
      }),
    ).rejects.toBeInstanceOf(z.ZodError);
    expect((await service.list(CHANGE)).map((d) => d.id)).toEqual([created.id]);
  });

  it('refuses a second document with the same title in the change', async () => {
    await service.create(CHANGE, document);

    expect(
      service.create(CHANGE, { ...document, content: 'Rewritten.' }),
    ).rejects.toBeInstanceOf(DuplicateDocumentError);
  });

  it('lets only one of two parallel creates with the same title through', async () => {
    const results = await Promise.allSettled([
      service.create(CHANGE, document),
      service.create(CHANGE, { ...document, content: 'Rewritten.' }),
    ]);

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    const stored = await service.findById(
      CHANGE,
      DocumentId.parse('booking-rules-v2'),
    );
    expect(stored?.document.content).toBe(document.content);
  });

  it('lets another change hold a document of the same title', async () => {
    const other = await t.createChange('billing');
    await service.create(CHANGE, document);

    const summary = await service.create(other, document);

    expect(summary.id).toBe(DocumentId.parse('booking-rules-v2'));
  });

  it('replaces the content under the same id', async () => {
    const created = await service.create(CHANGE, document);

    const updated = await service.update(CHANGE, DocumentId.parse(created.id), {
      ...document,
      content: 'A slot may be booked twice.',
    });

    expect(updated.id).toEqual(created.id);
    expect((await service.findById(CHANGE, created.id))?.document.content).toBe(
      'A slot may be booked twice.',
    );
    expect((await service.list(CHANGE)).map((d) => d.id)).toEqual([created.id]);
  });

  it('moves the document to a new id when the title changes', async () => {
    const created = await service.create(CHANGE, document);

    const renamed = await service.update(CHANGE, DocumentId.parse(created.id), {
      ...document,
      title: 'Booking rules v3',
    });

    expect(renamed.id).toBe(DocumentId.parse('booking-rules-v3'));
    expect(await service.findById(CHANGE, created.id)).toBe(null);
    expect((await service.list(CHANGE)).map((d) => d.id)).toEqual([
      DocumentId.parse('booking-rules-v3'),
    ]);
  });

  it('refuses a retitle onto a title the change already has', async () => {
    const created = await service.create(CHANGE, document);
    await service.create(CHANGE, { ...document, title: 'Pricing' });

    expect(
      service.update(CHANGE, DocumentId.parse(created.id), {
        ...document,
        title: 'Pricing',
      }),
    ).rejects.toBeInstanceOf(DuplicateDocumentError);
    expect((await service.findById(CHANGE, created.id))?.document.title).toBe(
      document.title,
    );
  });

  it('refuses to update a document the change does not have', async () => {
    expect(
      service.update(CHANGE, DocumentId.parse('missing'), document),
    ).rejects.toBeInstanceOf(DocumentNotFoundError);
  });

  it('lists newest first, then by title', async () => {
    await service.create(CHANGE, {
      ...document,
      title: 'Older',
      date: '2026-09-01',
    });
    await service.create(CHANGE, {
      ...document,
      title: 'Newer',
      date: '2026-09-10',
    });
    await service.create(CHANGE, {
      ...document,
      title: 'Also newer',
      date: '2026-09-10',
    });

    expect((await service.list(CHANGE)).map((d) => d.title)).toEqual([
      'Also newer',
      'Newer',
      'Older',
    ]);
  });

  it('answers null for a document that does not exist and false when deleting it', async () => {
    expect(await service.findById(CHANGE, DocumentId.parse('missing'))).toBe(
      null,
    );
    expect(await service.delete(CHANGE, DocumentId.parse('missing'))).toBe(
      false,
    );
  });

  it('deletes a document it has', async () => {
    const created = await service.create(CHANGE, document);

    expect(await service.delete(CHANGE, DocumentId.parse(created.id))).toBe(
      true,
    );
    expect(await service.list(CHANGE)).toEqual([]);
  });

  it('refuses every operation on a change that has no directory', async () => {
    await expect(service.list(NOPE)).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
    await expect(service.create(NOPE, document)).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
    await expect(
      service.findById(NOPE, DocumentId.parse('x')),
    ).rejects.toBeInstanceOf(ChangeNotFoundError);
    await expect(
      service.delete(NOPE, DocumentId.parse('x')),
    ).rejects.toBeInstanceOf(ChangeNotFoundError);
  });
});
