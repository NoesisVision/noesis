import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ChangeSlug } from '../../src/app/changes/change-slug.js';
import { ChangeNotFoundError } from '../../src/app/changes/changes.service.js';
import {
  DesignDocNotFoundError,
  type DesignDocsService,
} from '../../src/app/design-docs/design-docs.service.js';
import { designDocFixture } from '../../src/shared/contracts/design-doc.fixture.js';
import { type TestNoesis, testNoesis } from './test-noesis.js';

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
  it('stores a valid document under a server-minted id and reads it back whole', async () => {
    const summary = await service.create(CHANGE, designDocFixture);

    // The server mints the id — whatever the input carried is replaced.
    expect(summary.id).not.toBe(designDocFixture.id);
    expect(summary.name).toBe('Appointment booking');

    const detail = await service.findById(CHANGE, summary.id);
    expect(detail?.document).toEqual({
      ...designDocFixture,
      id: summary.id,
    });
  });

  it('replaces a document whole under its id, ignoring the id in the input', async () => {
    const created = await service.createSample(CHANGE);

    const updated = await service.update(CHANGE, created.id, {
      ...designDocFixture,
      id: 'ignored',
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
      service.update(CHANGE, 'nope', designDocFixture),
    ).rejects.toBeInstanceOf(DesignDocNotFoundError);
  });

  it('creates the sample document dated today', async () => {
    const summary = await service.createSample(CHANGE);

    expect(summary.name).toBe('Appointment booking');
    expect(summary.date).toBe(new Date().toISOString().slice(0, 10));
    const listed = await service.list(CHANGE);
    expect(listed.map((d) => d.id)).toEqual([summary.id]);
  });

  it('answers null for a document that does not exist', async () => {
    expect(await service.findById(CHANGE, 'missing')).toBe(null);
  });

  it('refuses every operation on a change that has no directory', async () => {
    await expect(service.list(NOPE)).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
    await expect(service.create(NOPE, designDocFixture)).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
    await expect(service.findById(NOPE, 'x')).rejects.toBeInstanceOf(
      ChangeNotFoundError,
    );
    // An unsafe slug never reaches the service: it is not a `ChangeSlug`.
    expect(ChangeSlug.tryParse('../x')).toBeNull();
  });
});
