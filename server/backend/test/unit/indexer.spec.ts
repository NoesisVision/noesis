import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm, writeFile } from 'node:fs/promises';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import type { DatabaseService } from '../../src/database/database.service.js';
import { DesignDocsRepository } from '../../src/design-docs/design-docs.repository.js';
import { GraphIndexer } from '../../src/index/indexer.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';
import { type TestNoesis, testNoesis } from './test-noesis.js';

let db: DatabaseService;
let t: TestNoesis;
let designDocs: DesignDocsRepository;
let indexer: GraphIndexer;

beforeEach(async () => {
  db = await sharedTestDatabase();
  t = await testNoesis();
  designDocs = new DesignDocsRepository(t.changesRepository);
  indexer = new GraphIndexer(db, t.changesRepository, designDocs);
});

afterEach(async () => {
  await resetGraph();
  await t.cleanup();
});

interface Row {
  id: string;
  change: string;
  name: string;
}

const graphRows = () =>
  db.query<Row>(
    'MATCH (d:DesignDoc) RETURN d.id AS id, d.change AS change, d.name AS name ORDER BY id',
  );

describe('GraphIndexer', () => {
  it('projects every design doc of every change into the graph', async () => {
    await t.changesRepository.create('alpha');
    await t.changesRepository.create('beta');
    await designDocs.create('alpha', {
      ...designDocFixture,
      id: 'a1',
      name: 'A one',
    });
    await designDocs.create('alpha', {
      ...designDocFixture,
      id: 'a2',
      name: 'A two',
    });
    await designDocs.create('beta', {
      ...designDocFixture,
      id: 'b1',
      name: 'B one',
    });

    const report = await indexer.rebuild();

    expect(report.files).toBe(3);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
    expect(await graphRows()).toEqual([
      { id: 'a1', change: 'alpha', name: 'A one' },
      { id: 'a2', change: 'alpha', name: 'A two' },
      { id: 'b1', change: 'beta', name: 'B one' },
    ]);
  });

  it('is a function of the files alone: a rebuild drops what the files no longer hold', async () => {
    await t.changesRepository.create('alpha');
    await designDocs.create('alpha', { ...designDocFixture, id: 'a1' });
    await designDocs.create('alpha', {
      ...designDocFixture,
      id: 'a2',
      name: 'Two',
    });
    await indexer.rebuild();

    // What a `git checkout` does: files vanish and appear behind the service's back.
    await rm(t.noesis.resolve('changes', 'alpha'), { recursive: true });
    await t.changesRepository.create('gamma');
    await designDocs.create('gamma', {
      ...designDocFixture,
      id: 'g1',
      name: 'Renamed',
    });
    await designDocs.create('gamma', {
      ...designDocFixture,
      id: 'a2',
      name: 'Renamed too',
    });
    await indexer.rebuild();

    expect(await graphRows()).toEqual([
      { id: 'a2', change: 'gamma', name: 'Renamed too' },
      { id: 'g1', change: 'gamma', name: 'Renamed' },
    ]);
  });

  it('indexes an empty .noesis/ to an empty graph and skips what does not decode', async () => {
    expect((await indexer.rebuild()).files).toBe(0);

    await t.changesRepository.create('alpha');
    await designDocs.create('alpha', designDocFixture);
    await writeFile(
      t.changesRepository.dirOf('alpha', 'design-docs', 'junk-x.json'),
      '{',
    );

    expect((await indexer.rebuild()).files).toBe(1);
    expect((await graphRows()).map((r) => r.id)).toEqual([designDocFixture.id]);
  });

  it('stores the whole document beside its denormalised columns', async () => {
    await t.changesRepository.create('alpha');
    await designDocs.create('alpha', designDocFixture);
    await indexer.rebuild();

    const [row] = await db.query<{
      document: string;
      status: string;
      date: string;
    }>(
      'MATCH (d:DesignDoc) RETURN d.document AS document, d.status AS status, d.date AS date',
    );
    expect(row?.status).toBe(designDocFixture.status);
    expect(row?.date).toBe(designDocFixture.date);
    expect(JSON.parse(row?.document ?? '')).toEqual(designDocFixture);
  });
});
