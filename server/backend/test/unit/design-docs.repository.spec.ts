import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import type { DatabaseService } from '../../src/database/database.service.js';
import { DesignDocsRepository } from '../../src/design-docs/design-docs.repository.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';

let db: DatabaseService;
let designDocs: DesignDocsRepository;

beforeAll(async () => {
  db = await sharedTestDatabase();
  designDocs = new DesignDocsRepository(db);
});

afterEach(resetGraph);

describe('DesignDocsRepository', () => {
  it('creates a design document and reads it back', async () => {
    const created = await designDocs.create(designDocFixture);

    expect(created.name).toBe('Appointment booking');

    const found = await designDocs.findById(designDocFixture.id);
    expect(found?.status).toBe('draft');
    expect(JSON.parse(found?.document ?? '')).toEqual(designDocFixture);
  });

  it('lists documents newest date first', async () => {
    await designDocs.create({
      ...designDocFixture,
      id: 'doc-old',
      name: 'Older',
      date: '2026-01-01',
    });
    await designDocs.create({
      ...designDocFixture,
      id: 'doc-new',
      name: 'Newer',
      date: '2026-08-01',
    });

    const listed = await designDocs.list();
    expect(listed.map((d) => d.id)).toEqual(['doc-new', 'doc-old']);
  });

  it('deletes a document and reports a missing one', async () => {
    await designDocs.create(designDocFixture);

    expect(await designDocs.delete(designDocFixture.id)).toBe(true);
    expect(await designDocs.findById(designDocFixture.id)).toBe(null);
    expect(await designDocs.delete(designDocFixture.id)).toBe(false);
  });
});
