import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import { ChangeNotFoundError } from '#backend/app/changes/changes.service';
import { DesignDocument } from '#backend/app/design-docs/design-doc';
import {
  DesignDocNotFoundError,
  type DesignDocsService,
} from '#backend/app/design-docs/design-docs.service';
import {
  decodedDesignDocFixture,
  designDocFixture,
} from '../fixtures/design-doc.fixture';
import { type TestNoesis, testNoesis } from './test-noesis';

const CHANGE = ChangeSlug.parse('booking');
const NOPE = ChangeSlug.parse('nope');

let t: TestNoesis;
let service: DesignDocsService;

beforeEach(async () => {
  t = await testNoesis();
  await t.createChange(CHANGE);
  service = t.designDocsService;
});

afterEach(() => t.cleanup());

describe('DesignDocsService', () => {
  it('stores a valid document under a server-minted id and reads it back decoded', async () => {
    const summary = await service.create(CHANGE, decodedDesignDocFixture);

    expect(summary.id).not.toBe(designDocFixture.id);
    expect(summary.name).toBe('Partial refunds for orders');

    const detail = await service.findById(CHANGE, summary.id);
    expect(detail?.document).toEqual(
      DesignDocument.parse({ ...designDocFixture, id: summary.id }),
    );
  });

  it('replaces a document whole under its id, ignoring the id in the input', async () => {
    const created = await service.create(CHANGE, decodedDesignDocFixture);

    const updated = await service.update(CHANGE, created.id, {
      // Carries the fixture's own id, which the service ignores.
      ...decodedDesignDocFixture,
      name: 'Renamed',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Renamed');
    expect((await service.list(CHANGE)).map((d) => d.id)).toEqual([created.id]);
    expect((await service.findById(CHANGE, created.id))?.document.name).toBe(
      'Renamed',
    );
  });

  it('refuses to update a document the change does not have', async () => {
    expect(
      service.update(CHANGE, 'nope', decodedDesignDocFixture),
    ).rejects.toBeInstanceOf(DesignDocNotFoundError);
  });

  it('summarises what it stored, and lists it under the change by name', async () => {
    const summary = await service.create(CHANGE, decodedDesignDocFixture);
    const other = await service.create(CHANGE, {
      ...decodedDesignDocFixture,
      name: 'Another design',
      implemented: true,
    });

    expect(summary.name).toBe('Partial refunds for orders');
    expect(summary.implemented).toBe(false);
    expect(other.implemented).toBe(true);
    expect(summary.path).toEndWith(`/${summary.id}/data.json`);
    const listed = await service.list(CHANGE);
    expect(listed.map((d) => d.id)).toEqual([other.id, summary.id]);
  });

  it('answers null for a document that does not exist', async () => {
    expect(await service.findById(CHANGE, 'missing')).toBe(null);
  });

  it('refuses every operation on a change that has no directory', async () => {
    await expect(service.list(NOPE)).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
    await expect(
      service.create(NOPE, decodedDesignDocFixture),
    ).rejects.toBeInstanceOf(ChangeNotFoundError);
    await expect(service.findById(NOPE, 'x')).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
    // An unsafe slug never reaches the service: it is not a `ChangeSlug`.
    expect(ChangeSlug.safeParse('../x').success).toBe(false);
  });
});
