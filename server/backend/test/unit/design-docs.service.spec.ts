import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import { DesignDocumentSchema } from '#backend/app/design-docs/design-doc';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import type { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import {
  decodedDesignDocFixture,
  designDocFixture,
} from '../fixtures/design-doc.fixture';
import { errOf, okOf } from '../support/result';
import { type TestNoesis, testNoesis } from './test-noesis';

const CHANGE = ChangeSlug.create('booking');
const NOPE = ChangeSlug.create('nope');

let t: TestNoesis;
let service: DesignDocsService;

beforeEach(async () => {
  t = await testNoesis();
  await t.createChange(CHANGE);
  service = t.designDocsService;
});

afterEach(() => t.cleanup());

const idOf = (summary: { id: string }) => DesignDocId.create(summary.id);

describe('DesignDocsService', () => {
  it('stores a valid document under a server-minted id and reads it back decoded', async () => {
    const summary = await okOf(service.create(CHANGE, decodedDesignDocFixture));

    expect(summary.id).not.toBe(designDocFixture.id);
    expect(summary.name).toBe('Partial refunds for orders');

    const detail = await okOf(service.findById(CHANGE, idOf(summary)));
    expect(detail.document).toEqual(
      DesignDocumentSchema.parse({ ...designDocFixture, id: summary.id }),
    );
  });

  it('replaces a document whole under its id, ignoring the id in the input', async () => {
    const created = await okOf(service.create(CHANGE, decodedDesignDocFixture));

    const updated = await okOf(
      service.update(CHANGE, idOf(created), {
        // Carries the fixture's own id, which the service ignores.
        ...decodedDesignDocFixture,
        name: { value: 'Renamed', reviewedByHuman: false },
      }),
    );

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Renamed');
    const listed = await okOf(service.list(CHANGE));
    expect(listed.map((d) => d.id)).toEqual([created.id]);
    const stored = await okOf(service.findById(CHANGE, idOf(created)));
    expect(stored.document.name.value).toBe('Renamed');
  });

  it('refuses to update a document the change does not have', async () => {
    const refused = await errOf(
      service.update(
        CHANGE,
        DesignDocId.create('nope'),
        decodedDesignDocFixture,
      ),
    );
    expect(refused.kind).toBe('design-doc-not-found');
  });

  it('summarises what it stored, and lists it under the change by name', async () => {
    const summary = await okOf(service.create(CHANGE, decodedDesignDocFixture));
    const other = await okOf(
      service.create(CHANGE, {
        ...decodedDesignDocFixture,
        name: { value: 'Another design', reviewedByHuman: false },
        implemented: true,
      }),
    );

    expect(summary.name).toBe('Partial refunds for orders');
    expect(summary.implemented).toBe(false);
    expect(other.implemented).toBe(true);
    expect(summary.path).toEndWith(`/${summary.id}/data.json`);
    const listed = await okOf(service.list(CHANGE));
    expect(listed.map((d) => d.id)).toEqual([other.id, summary.id]);
  });

  it('answers DesignDocNotFound for a document it does not have, on read and on delete', async () => {
    const missing = DesignDocId.create('missing');
    expect((await errOf(service.findById(CHANGE, missing))).kind).toBe(
      'design-doc-not-found',
    );
    expect((await errOf(service.delete(CHANGE, missing))).kind).toBe(
      'design-doc-not-found',
    );
  });

  it('deletes a document it has', async () => {
    const created = await okOf(service.create(CHANGE, decodedDesignDocFixture));

    await okOf(service.delete(CHANGE, idOf(created)));

    expect(await okOf(service.list(CHANGE))).toEqual([]);
  });

  it('answers ChangeNotFound to every operation on a change that has no directory', async () => {
    const id = DesignDocId.create('x');
    const kinds = await Promise.all([
      errOf(service.list(NOPE)),
      errOf(service.create(NOPE, decodedDesignDocFixture)),
      errOf(service.findById(NOPE, id)),
      errOf(service.update(NOPE, id, decodedDesignDocFixture)),
      errOf(service.delete(NOPE, id)),
    ]);
    expect(kinds.map((error) => error.kind)).toEqual(
      Array(5).fill('change-not-found'),
    );
    // An unsafe slug never reaches the service: it is not a `ChangeSlug`.
    expect(ChangeSlug.tryCreate('../x').isErr()).toBe(true);
  });
});
