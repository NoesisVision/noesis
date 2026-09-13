import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import { ChangeSlug } from '../../src/changes/change-slug.js';
import { DesignDocsRepository } from '../../src/design-docs/design-docs.repository.js';
import { type TestNoesis, testNoesis } from './test-noesis.js';

const CHANGE = ChangeSlug.parse('booking');
const OTHER = ChangeSlug.parse('other');

let t: TestNoesis;
let designDocs: DesignDocsRepository;

beforeEach(async () => {
  t = await testNoesis();
  await t.createChange(CHANGE);
  designDocs = new DesignDocsRepository(t.changesRepository);
});

afterEach(() => t.cleanup());

describe('DesignDocsRepository', () => {
  it('writes a design document under the change and reads it back', async () => {
    const created = await designDocs.create(CHANGE, designDocFixture);

    expect(created.entity.name).toBe('Appointment booking');
    expect(
      await readdir(t.changesRepository.dirOf(CHANGE, 'design-docs')),
    ).toEqual([`appointment-booking-${designDocFixture.id.slice(-12)}.json`]);

    const found = await designDocs.findById(CHANGE, designDocFixture.id);
    expect(found?.entity).toEqual(designDocFixture);
  });

  it('lists documents newest date first, then by name', async () => {
    for (const [id, name, date] of [
      ['doc-old', 'Older', '2026-01-01'],
      ['doc-b', 'Beta', '2026-08-01'],
      ['doc-a', 'Alpha', '2026-08-01'],
    ] as const) {
      await designDocs.create(CHANGE, { ...designDocFixture, id, name, date });
    }

    const listed = await designDocs.list(CHANGE);
    expect(listed.map((d) => d.entity.id)).toEqual([
      'doc-a',
      'doc-b',
      'doc-old',
    ]);
  });

  it('keeps the changes apart', async () => {
    await t.createChange(OTHER);
    await designDocs.create(CHANGE, designDocFixture);

    expect(await designDocs.list(OTHER)).toEqual([]);
    expect(await designDocs.findById(OTHER, designDocFixture.id)).toBe(null);
  });

  it('deletes a document and reports a missing one', async () => {
    await designDocs.create(CHANGE, designDocFixture);

    expect(await designDocs.delete(CHANGE, designDocFixture.id)).toBe(true);
    expect(await designDocs.findById(CHANGE, designDocFixture.id)).toBe(null);
    expect(await designDocs.delete(CHANGE, designDocFixture.id)).toBe(false);
  });
});
