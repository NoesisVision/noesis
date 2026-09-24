import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { IndexService } from '#backend/adapters/graph/index.service';
import { ChangeId } from '#backend/app/changes/change-id';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc';
import type { DatabaseService } from '#backend/platform/database/database.service';
import { designDocFixture } from '../fixtures/design-doc.fixture';
import { resetGraph, sharedTestDatabase } from './test-db';
import { type TestNoesis, testNoesis } from './test-noesis';

const ALPHA = ChangeId.parse('2026-01-01-alpha');
const BETA = ChangeId.parse('2026-01-02-beta');
const GAMMA = ChangeId.parse('2026-01-03-gamma');

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

const writeDoc = (change: ChangeId, document: DesignDocumentInput) =>
  t.writeDesignDoc(change, document);

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
      id: '2026-01-01-a1',
      name: { value: 'A one' },
    });
    await writeDoc(ALPHA, {
      ...designDocFixture,
      id: '2026-01-01-a2',
      name: { value: 'A two' },
    });
    await writeDoc(BETA, {
      ...designDocFixture,
      id: '2026-01-01-b1',
      name: { value: 'B one' },
    });

    const report = await indexer.rebuild();

    expect(report.files).toBe(3);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
    expect(await graphRows()).toEqual([
      { id: '2026-01-01-a1', change: '2026-01-01-alpha', name: 'A one' },
      { id: '2026-01-01-a2', change: '2026-01-01-alpha', name: 'A two' },
      { id: '2026-01-01-b1', change: '2026-01-02-beta', name: 'B one' },
    ]);
  });

  it('keeps a design doc id apart in each change that holds it', async () => {
    await t.createChange(ALPHA);
    await t.createChange(BETA);
    await writeDoc(ALPHA, { ...designDocFixture, name: { value: 'In alpha' } });
    await writeDoc(BETA, { ...designDocFixture, name: { value: 'In beta' } });

    await indexer.rebuild();

    expect((await graphRows()).map((r) => r.name).sort()).toEqual([
      'In alpha',
      'In beta',
    ]);
  });

  it('is a function of the files alone: a rebuild drops what the files no longer hold', async () => {
    await t.createChange(ALPHA);
    await writeDoc(ALPHA, { ...designDocFixture, id: '2026-01-01-a1' });
    await writeDoc(ALPHA, {
      ...designDocFixture,
      id: '2026-01-01-a2',
      name: { value: 'Two' },
    });
    await indexer.rebuild();

    // What a `git checkout` does: files vanish and appear behind the service's back.
    await rm(join(t.changesDir, ALPHA), { recursive: true });
    await rm(join(t.changesDir, `${ALPHA}.change.json`));
    await t.createChange(GAMMA);
    await writeDoc(GAMMA, {
      ...designDocFixture,
      id: '2026-01-01-g1',
      name: { value: 'Renamed' },
    });
    await writeDoc(GAMMA, {
      ...designDocFixture,
      id: '2026-01-01-a2',
      name: { value: 'Renamed too' },
    });
    await indexer.rebuild();

    expect(await graphRows()).toEqual([
      { id: '2026-01-01-a2', change: '2026-01-03-gamma', name: 'Renamed too' },
      { id: '2026-01-01-g1', change: '2026-01-03-gamma', name: 'Renamed' },
    ]);
  });

  it('indexes an empty .noesis/ to an empty graph and skips the list a broken file is in', async () => {
    expect((await indexer.rebuild()).files).toBe(0);

    await t.createChange(ALPHA);
    await t.createChange(BETA);
    await writeDoc(ALPHA, designDocFixture);
    await writeFile(
      join(t.changesDir, ALPHA, '2026-01-01-junk.design-doc.json'),
      '{',
    );
    await writeDoc(BETA, { ...designDocFixture, id: '2026-01-01-b1' });

    expect((await indexer.rebuild()).files).toBe(1);
    expect((await graphRows()).map((r) => r.id)).toEqual(['2026-01-01-b1']);
  });

  it('projects imported documents into their own table', async () => {
    await t.createChange(ALPHA);
    await t.writeDocument(ALPHA, {
      id: '2026-09-01-rules',
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
