import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import type { CreateDocument } from '#backend/app/information-sources/document';
import { DocumentId } from '#backend/app/information-sources/document-id';
import type { DocumentsService } from '#backend/app/information-sources/documents.service';
import { ValueObjectError } from '#backend/app/vo';
import { errOf, okOf } from '../support/result';
import { type TestNoesis, testNoesis } from './test-noesis';

const CHANGE = ChangeSlug.create('booking');
const NOPE = ChangeSlug.create('nope');

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

const idOf = (summary: { id: string }) => DocumentId.create(summary.id);
const listed = async () => okOf(service.list(CHANGE));

describe('DocumentsService', () => {
  it('stores a document under the slug of its title and reads it back whole', async () => {
    const summary = await okOf(service.create(CHANGE, document));

    expect(summary.id).toBe('booking-rules-v2');
    expect(summary.path).toEndWith(
      '/graph/changes/booking/documents/booking-rules-v2/data.json',
    );

    const detail = await okOf(service.findById(CHANGE, idOf(summary)));
    expect(detail.document).toEqual({
      ...document,
      document_id: DocumentId.create('booking-rules-v2'),
    });
  });

  it('throws on a title no id can be derived from, on create and on retitle', async () => {
    expect(
      Promise.resolve(service.create(CHANGE, { ...document, title: '!!!' })),
    ).rejects.toBeInstanceOf(ValueObjectError);

    const created = await okOf(service.create(CHANGE, document));
    expect(
      Promise.resolve(
        service.update(CHANGE, idOf(created), { ...document, title: '日本語' }),
      ),
    ).rejects.toBeInstanceOf(ValueObjectError);
    expect((await listed()).map((d) => d.id)).toEqual([created.id]);
  });

  it('refuses a second document with the same title in the change', async () => {
    await okOf(service.create(CHANGE, document));

    const refused = await errOf(
      service.create(CHANGE, { ...document, content: 'Rewritten.' }),
    );

    expect(refused.kind).toBe('duplicate-document');
  });

  it('lets only one of two parallel creates with the same title through', async () => {
    const results = await Promise.all([
      service.create(CHANGE, document),
      service.create(CHANGE, { ...document, content: 'Rewritten.' }),
    ]);

    expect(results.map((r) => r.isOk())).toEqual([true, false]);
    const stored = await okOf(
      service.findById(CHANGE, DocumentId.create('booking-rules-v2')),
    );
    expect(stored.document.content).toBe(document.content);
  });

  it('lets another change hold a document of the same title', async () => {
    const other = await t.createChange('billing');
    await okOf(service.create(CHANGE, document));

    const summary = await okOf(service.create(other, document));

    expect(summary.id).toBe('booking-rules-v2');
  });

  it('replaces the content under the same id', async () => {
    const created = await okOf(service.create(CHANGE, document));

    const updated = await okOf(
      service.update(CHANGE, idOf(created), {
        ...document,
        content: 'A slot may be booked twice.',
      }),
    );

    expect(updated.id).toEqual(created.id);
    const stored = await okOf(service.findById(CHANGE, idOf(created)));
    expect(stored.document.content).toBe('A slot may be booked twice.');
    expect((await listed()).map((d) => d.id)).toEqual([created.id]);
  });

  it('moves the document to a new id when the title changes', async () => {
    const created = await okOf(service.create(CHANGE, document));

    const renamed = await okOf(
      service.update(CHANGE, idOf(created), {
        ...document,
        title: 'Booking rules v3',
      }),
    );

    expect(renamed.id).toBe('booking-rules-v3');
    expect((await errOf(service.findById(CHANGE, idOf(created)))).kind).toBe(
      'document-not-found',
    );
    expect((await listed()).map((d) => d.id)).toEqual(['booking-rules-v3']);
  });

  it('refuses a retitle onto a title the change already has', async () => {
    const created = await okOf(service.create(CHANGE, document));
    await okOf(service.create(CHANGE, { ...document, title: 'Pricing' }));

    const refused = await errOf(
      service.update(CHANGE, idOf(created), { ...document, title: 'Pricing' }),
    );

    expect(refused.kind).toBe('duplicate-document');
    const stored = await okOf(service.findById(CHANGE, idOf(created)));
    expect(stored.document.title).toBe(document.title);
  });

  it('refuses to update a document the change does not have', async () => {
    const refused = await errOf(
      service.update(CHANGE, DocumentId.create('missing'), document),
    );
    expect(refused.kind).toBe('document-not-found');
  });

  it('lists newest first, then by title', async () => {
    await okOf(
      service.create(CHANGE, {
        ...document,
        title: 'Older',
        date: '2026-09-01',
      }),
    );
    await okOf(
      service.create(CHANGE, {
        ...document,
        title: 'Newer',
        date: '2026-09-10',
      }),
    );
    await okOf(
      service.create(CHANGE, {
        ...document,
        title: 'Also newer',
        date: '2026-09-10',
      }),
    );

    expect((await listed()).map((d) => d.title)).toEqual([
      'Also newer',
      'Newer',
      'Older',
    ]);
  });

  it('answers DocumentNotFound for a document it does not have, on read and on delete', async () => {
    const missing = DocumentId.create('missing');
    expect((await errOf(service.findById(CHANGE, missing))).kind).toBe(
      'document-not-found',
    );
    expect((await errOf(service.delete(CHANGE, missing))).kind).toBe(
      'document-not-found',
    );
  });

  it('deletes a document it has', async () => {
    const created = await okOf(service.create(CHANGE, document));

    await okOf(service.delete(CHANGE, idOf(created)));

    expect(await listed()).toEqual([]);
  });

  it('answers ChangeNotFound to every operation on a change that has no directory', async () => {
    const id = DocumentId.create('x');
    const kinds = await Promise.all([
      errOf(service.list(NOPE)),
      errOf(service.create(NOPE, document)),
      errOf(service.findById(NOPE, id)),
      errOf(service.update(NOPE, id, document)),
      errOf(service.delete(NOPE, id)),
    ]);
    expect(kinds.map((error) => error.kind)).toEqual(
      Array(5).fill('change-not-found'),
    );
  });
});
