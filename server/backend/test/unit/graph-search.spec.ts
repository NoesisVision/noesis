import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createGraphSearch } from '#backend/adapters/graph/graph-search';
import { IndexService } from '#backend/adapters/graph/index.service';
import { ChangeId } from '#backend/app/changes/change-id';
import { SearchService } from '#backend/app/search/search.service';
import type { DatabaseService } from '#backend/platform/database/database.service';
import { designDocFixture } from '../fixtures/design-doc.fixture';
import { resetGraph, sharedTestDatabase } from './test-db';
import { type TestNoesis, testNoesis } from './test-noesis';

const ALPHA = ChangeId.parse('2026-01-01-alpha');

let db: DatabaseService;
let t: TestNoesis;
let search: SearchService;

beforeEach(async () => {
  db = await sharedTestDatabase();
  t = await testNoesis();
  search = new SearchService([createGraphSearch(db)]);
});

afterEach(async () => {
  await resetGraph();
  await t.cleanup();
});

describe('graph search', () => {
  it('finds design docs by a case-insensitive substring', async () => {
    await t.createChange(ALPHA);
    await t.writeDesignDoc(ALPHA, designDocFixture);
    await new IndexService(db, t.sources).rebuild();

    const results = await search.search('REFUNDS');

    expect(results).toEqual([
      {
        type: 'design-doc',
        id: designDocFixture.id,
        title: 'Partial refunds for orders',
        subtitle: 'draft',
        href: `/changes/2026-01-01-alpha/design-docs/${designDocFixture.id}`,
      },
    ]);
  });

  it('answers nothing for a query nothing matches', async () => {
    await new IndexService(db, t.sources).rebuild();
    expect(await search.search('zebra')).toEqual([]);
  });
});
