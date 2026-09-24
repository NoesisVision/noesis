import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm, writeFile } from 'node:fs/promises';
import { IndexService } from '#backend/adapters/graph/index.service';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc';
import type { DatabaseService } from '#backend/platform/database/database.service';
import { designDocFixture } from '../fixtures/design-doc.fixture';
import { resetGraph, sharedTestDatabase } from './test-db';
import { type TestNoesis, testNoesis } from './test-noesis';

const ALPHA = ChangeSlug.parse('alpha');
const BETA = ChangeSlug.parse('beta');
const GAMMA = ChangeSlug.parse('gamma');

let db: DatabaseService;
let t: TestNoesis;
let indexer: IndexService;

beforeEach(async () => {
  db = await sharedTestDatabase();
  t = await testNoesis();
  indexer = new IndexService(db, t.sources);
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

const writeDoc = (slug: ChangeSlug, document: DesignDocumentInput) =>
  t.changesRepository.children(slug)['design-docs'].set(document.id, document);

const graphRows = () =>
  db.query<Row>(
    'MATCH (d:DesignDoc) RETURN d.id AS id, d.change AS change, d.name AS name ORDER BY id',
  );

describe('IndexService', () => {
  it('projects every design doc of every change into the graph', async () => {
    await t.createChange(ALPHA);
    await t.createChange(BETA);
    await writeDoc(ALPHA, {
      ...designDocFixture,
      id: 'a1',
      name: 'A one',
    });
    await writeDoc(ALPHA, {
      ...designDocFixture,
      id: 'a2',
      name: 'A two',
    });
    await writeDoc(BETA, {
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
    await t.createChange(ALPHA);
    await writeDoc(ALPHA, { ...designDocFixture, id: 'a1' });
    await writeDoc(ALPHA, {
      ...designDocFixture,
      id: 'a2',
      name: 'Two',
    });
    await indexer.rebuild();

    // What a `git checkout` does: files vanish and appear behind the service's back.
    await rm(t.changesRepository.dirOf(ALPHA), { recursive: true });
    await t.createChange(GAMMA);
    await writeDoc(GAMMA, {
      ...designDocFixture,
      id: 'g1',
      name: 'Renamed',
    });
    await writeDoc(GAMMA, {
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

    await t.createChange(ALPHA);
    await writeDoc(ALPHA, designDocFixture);
    await writeDoc(ALPHA, { ...designDocFixture, id: 'junk' });
    await writeFile(
      t.changesRepository.children(ALPHA)['design-docs'].dataFile('junk'),
      '{',
    );

    expect((await indexer.rebuild()).files).toBe(1);
    expect((await graphRows()).map((r) => r.id)).toEqual([designDocFixture.id]);
  });

  it('projects imported documents into their own table', async () => {
    await t.createChange(ALPHA);
    await t.changesRepository.children(ALPHA).documents.set('doc-1', {
      document_id: 'doc-1',
      title: 'Rules',
      date: '2026-09-01',
      content: '',
    });

    const report = await indexer.rebuild();

    expect(report.files).toBe(1);
    const count = async (table: string) =>
      (
        await db.query<{ n: number | bigint }>(
          `MATCH (x:${table}) RETURN count(x) AS n`,
        )
      ).map((r) => Number(r.n))[0];
    expect(await count('Document')).toBe(1);
    const [document] = await db.query<{ change: string; json: string }>(
      'MATCH (d:Document) RETURN d.change AS change, d.json AS json',
    );
    expect(document?.change).toBe(ALPHA);
    expect(JSON.parse(document?.json ?? '').title).toBe('Rules');
  });

  it('stores the whole document beside its denormalised columns', async () => {
    await t.createChange(ALPHA);
    await writeDoc(ALPHA, designDocFixture);
    await indexer.rebuild();

    const [row] = await db.query<{
      document: string;
      implemented: boolean;
    }>(
      'MATCH (d:DesignDoc) RETURN d.document AS document, d.implemented AS implemented',
    );
    expect(row?.implemented).toBe(false);
    expect(JSON.parse(row?.document ?? '')).toEqual(designDocFixture);
  });
});
