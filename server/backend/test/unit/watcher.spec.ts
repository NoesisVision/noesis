import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import { ChangeSlug } from '../../src/changes/change-slug.js';
import type { DatabaseService } from '../../src/database/database.service.js';
import { DesignDocsRepository } from '../../src/design-docs/design-docs.repository.js';
import { GraphIndexer } from '../../src/index/indexer.js';
import { isIgnored, NoesisWatcher } from '../../src/index/watcher.js';
import { resetGraph, sharedTestDatabase } from './test-db.js';
import { type TestNoesis, testNoesis } from './test-noesis.js';

const ALPHA = ChangeSlug.parse('alpha');
const BETA = ChangeSlug.parse('beta');

const DEBOUNCE_MS = 50;

let t: TestNoesis;
let watcher: NoesisWatcher | null = null;

beforeEach(async () => {
  t = await testNoesis();
});

afterEach(async () => {
  watcher?.close();
  watcher = null;
  await t.cleanup();
});

const quiet = () => new Promise((r) => setTimeout(r, DEBOUNCE_MS * 4));

/**
 * A watcher over a counting rebuild. The OS stream takes a moment to start
 * delivering, so the fixture waits before handing the watcher out.
 */
async function countingWatcher(): Promise<{
  watcher: NoesisWatcher;
  rebuilds: () => number;
}> {
  let count = 0;
  watcher = new NoesisWatcher(
    t.noesis,
    async () => {
      count += 1;
    },
    { debounceMs: DEBOUNCE_MS },
  );
  watcher.start();
  await quiet();
  return { watcher, rebuilds: () => count };
}

describe('NoesisWatcher', () => {
  it('rebuilds once for a burst of writes under a kind directory', async () => {
    const { watcher, rebuilds } = await countingWatcher();
    const dir = t.changesRepository.dirOf(ALPHA, 'design-docs');
    await mkdir(dir, { recursive: true });
    await waitFor(async () => rebuilds() >= 1);
    // The OS delivers the events of the nested mkdir over a moment; let them
    // all land before counting the burst.
    await quiet();
    await watcher.settle();
    const before = rebuilds();

    await writeFile(`${dir}/one-1.json`, '{"id":"1"}');
    await writeFile(`${dir}/two-2.json`, '{"id":"2"}');
    await writeFile(`${dir}/three-3.json`, '{"id":"3"}');
    await waitFor(async () => rebuilds() > before);
    await quiet();
    await watcher.settle();

    expect(rebuilds()).toBe(before + 1);
  });

  it('ignores tmp/ and the service’s own temp and ignore files', async () => {
    const { watcher, rebuilds } = await countingWatcher();
    await mkdir(t.noesis.resolve('tmp', 'session-1'), { recursive: true });
    await quiet();
    await watcher.settle();
    const before = rebuilds();

    await writeFile(t.noesis.resolve('tmp', 'session-1', 'work.json'), '{}');
    await writeFile(t.noesis.resolve('.gitignore'), 'tmp/\n');
    await quiet();
    await watcher.settle();

    expect(rebuilds()).toBe(before);
    expect(isIgnored('tmp')).toBe(true);
    expect(isIgnored('tmp/s/x.json')).toBe(true);
    expect(isIgnored('graph/changes/a/design-docs/x.json.abc.tmp')).toBe(true);
    expect(isIgnored('.gitignore')).toBe(true);
    expect(isIgnored('graph/changes/a/design-docs/x.json')).toBe(false);
    expect(isIgnored('graph')).toBe(false);
  });

  it('keeps the graph a function of the files across a checkout-like swap', async () => {
    const db: DatabaseService = await sharedTestDatabase();
    const designDocs = new DesignDocsRepository(t.changesRepository);
    const indexer = new GraphIndexer(db, t.sources);
    await t.createChange(ALPHA);
    await designDocs.create(ALPHA, {
      ...designDocFixture,
      id: 'a1',
      name: 'Before',
    });
    await indexer.rebuild();
    watcher = new NoesisWatcher(t.noesis, () => indexer.rebuild(), {
      debounceMs: DEBOUNCE_MS,
    });
    watcher.start();
    await quiet(); // let the OS stream start delivering
    const ids = async () =>
      (
        await db.query<{ id: string }>(
          'MATCH (d:DesignDoc) RETURN d.id AS id ORDER BY id',
        )
      ).map((r) => r.id);
    expect(await ids()).toEqual(['a1']);

    // Behind the service's back, as `git checkout` would.
    await rm(t.changesRepository.dirOf(ALPHA), { recursive: true });
    await t.createChange(BETA);
    const other = t.changesRepository.dirOf(BETA, 'design-docs');
    await mkdir(other, { recursive: true });
    await writeFile(
      `${other}/after-b1.json`,
      JSON.stringify({ ...designDocFixture, id: 'b1', name: 'After' }),
    );
    await waitFor(async () => (await ids()).join() === 'b1');

    expect(await ids()).toEqual(['b1']);
    await resetGraph();
  });
});

async function waitFor(condition: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('Condition not met within 5 s');
}
