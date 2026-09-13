import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import { ChangeSlug } from '../../src/changes/change-slug.js';
import type { DatabaseService } from '../../src/database/database.service.js';
import { GraphIndexer } from '../../src/index/indexer.js';
import { createGraphSearch } from '../../src/search/graph-search.js';
import { SearchService } from '../../src/ui/search/search.service.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';
import { put, type TestNoesis, testNoesis } from './test-noesis.js';

const ALPHA = ChangeSlug.parse('alpha');

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
  it('finds topics, decisions and design docs by a case-insensitive substring', async () => {
    await t.createChange(ALPHA);
    await t.changesRepository
      .children(ALPHA)
      ['design-docs'].set(designDocFixture.id, designDocFixture);
    await put(t.topics, {
      id: 't-1',
      parent_id: null,
      title: 'Appointment slots',
      title_locked: false,
      short_summary: 'How slots are held.',
      short_summary_locked: false,
      long_summary: '',
      long_summary_locked: false,
      items: [],
    });
    await put(t.topics, {
      id: 't-2',
      parent_id: 't-1',
      title: 'Payments',
      title_locked: false,
      short_summary: 'Paying for an appointment.',
      short_summary_locked: false,
      long_summary: '',
      long_summary_locked: false,
      items: [],
    });
    await put(t.decisions, {
      id: 'd-1',
      topic_id: 't-1',
      title: 'Hold appointment slots for ten minutes',
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
    await new GraphIndexer(db, t.sources).rebuild();

    const results = await search.search('APPOINTMENT');

    expect(results).toEqual([
      {
        type: 'topic',
        id: 't-1',
        title: 'Appointment slots',
        subtitle: 'How slots are held.',
        href: undefined,
      },
      {
        type: 'topic',
        id: 't-2',
        title: 'Payments',
        subtitle: 'Paying for an appointment.',
        href: undefined,
      },
      {
        type: 'decision',
        id: 'd-1',
        title: 'Hold appointment slots for ten minutes',
        subtitle: 'accepted',
        href: undefined,
      },
      {
        type: 'design-doc',
        id: designDocFixture.id,
        title: 'Appointment booking',
        subtitle: 'draft',
        href: `/changes/alpha/design-docs/${designDocFixture.id}`,
      },
    ]);
  });

  it('answers nothing for a query nothing matches', async () => {
    await new GraphIndexer(db, t.sources).rebuild();
    expect(await search.search('zebra')).toEqual([]);
  });
});
