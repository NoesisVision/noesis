import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm, writeFile } from 'node:fs/promises';
import { ChangeSlug } from '../../src/app/changes/change-slug.js';
import { IndexService } from '../../src/app/index/index.service.js';
import type { DatabaseService } from '../../src/platform/database/database.service.js';
import { dataFileOf } from '../../src/platform/files/noesis-store.js';
import { designDocFixture } from '../../src/shared/contracts/design-doc.fixture.js';
import type { DesignDocument } from '../../src/shared/contracts/index.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';
import { put, type TestNoesis, testNoesis } from './test-noesis.js';

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

const writeDoc = (slug: ChangeSlug, document: DesignDocument) =>
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
      dataFileOf(t.changesRepository.children(ALPHA)['design-docs'], 'junk'),
      '{',
    );

    expect((await indexer.rebuild()).files).toBe(1);
    expect((await graphRows()).map((r) => r.id)).toEqual([designDocFixture.id]);
  });

  it('projects sources and the wiki into their own tables', async () => {
    await t.createChange(ALPHA);
    await t.changesRepository.children(ALPHA).conversations.set('c-1', {
      conversation_id: 'c-1',
      time: '2026-09-12T10:00:00Z',
      main_topic: 'Slots',
      turns: [],
    });
    await t.changesRepository.children(ALPHA).documents.set('doc-1', {
      document_id: 'doc-1',
      title: 'Rules',
      date: '2026-09-01',
      fragments: [],
      section_tree: [],
    });
    await put(t.topics, {
      id: 't-1',
      parent_id: null,
      title: 'Slots',
      title_locked: false,
      short_summary: 's',
      short_summary_locked: false,
      long_summary: 'l',
      long_summary_locked: false,
      items: [],
    });
    await put(t.decisions, {
      id: 'd-1',
      topic_id: 't-1',
      title: 'Ten minutes',
      title_locked: false,
      status: 'accepted',
      status_locked: false,
      context: { text: '', text_locked: false, supporting_info: [] },
      decision: {
        text: '',
        text_locked: false,
        rationale: '',
        rationale_locked: false,
        supporting_info: [],
      },
      alternative_options: [],
    });

    const report = await indexer.rebuild();

    expect(report.files).toBe(4);
    const count = async (table: string) =>
      (
        await db.query<{ n: number | bigint }>(
          `MATCH (x:${table}) RETURN count(x) AS n`,
        )
      ).map((r) => Number(r.n))[0];
    expect(await count('Conversation')).toBe(1);
    expect(await count('Document')).toBe(1);
    expect(await count('Topic')).toBe(1);
    expect(await count('Decision')).toBe(1);
    const [decision] = await db.query<{ topic_id: string; json: string }>(
      'MATCH (d:Decision) RETURN d.topic_id AS topic_id, d.json AS json',
    );
    expect(decision?.topic_id).toBe('t-1');
    expect(JSON.parse(decision?.json ?? '').title).toBe('Ten minutes');
  });

  it('stores the whole document beside its denormalised columns', async () => {
    await t.createChange(ALPHA);
    await writeDoc(ALPHA, designDocFixture);
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
