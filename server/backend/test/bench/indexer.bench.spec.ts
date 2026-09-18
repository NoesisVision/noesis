// Boot re-index cost (decision D2): a synthetic `.noesis/` at 1k
// and 10k design docs, indexed from cold. Not part of `bun test test/unit`;
// run with `bun run test:bench` and record the numbers in
// docs/work/chores/target-architecture-migration.md.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IndexService } from '#backend/adapters/graph/index.service';
import { SchemaService } from '#backend/adapters/graph/schema.service';
import { NoesisChangesRepository } from '#backend/adapters/store/changes.repository';
import { createSystemModelStore } from '#backend/adapters/store/system-model.store';
import {
  createDecisionsStore,
  createTopicsStore,
} from '#backend/adapters/store/wiki.store';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import { DatabaseService } from '#backend/platform/database/database.service';
import { NoesisDir } from '#backend/platform/files/noesis-dir';
import { dataFileOf } from '#backend/platform/files/noesis-store';
import { designDocFixture } from '#backend/shared/contracts/design-doc.fixture';

const CHANGES = 20;
const BUDGET_MS_AT_10K = 2000;

let db: DatabaseService;

beforeAll(async () => {
  db = new DatabaseService();
  await db.init();
  await new SchemaService(db).ensureSchema();
});

afterAll(() => db.close());

async function syntheticNoesis(files: number): Promise<NoesisDir> {
  const root = await mkdtemp(join(tmpdir(), 'noesis-bench-'));
  const noesis = new NoesisDir(root);
  await noesis.ensure();
  const changes = new NoesisChangesRepository(noesis);
  const designDocs = (slug: ChangeSlug) =>
    changes.children(slug)['design-docs'];
  for (let c = 0; c < CHANGES; c++) {
    const slug = ChangeSlug.parse(`change-${c}`);
    await changes.write({
      slug: slug.value,
      name: slug.value,
      key: '',
      type: 'chore',
      status: 'discovery',
      created_at: '2026-09-13T00:00:00.000Z',
      description: '',
    });
    await mkdir(designDocs(slug).directory, { recursive: true });
  }
  for (let i = 0; i < files; i++) {
    const id = `00000000-0000-7000-8000-${String(i).padStart(12, '0')}`;
    const name = `Design doc ${i}`;
    const slug = ChangeSlug.parse(`change-${i % CHANGES}`);
    await mkdir(join(designDocs(slug).directory, id));
    await writeFile(
      dataFileOf(designDocs(slug), id),
      JSON.stringify({ ...designDocFixture, id, name }, null, 2),
    );
  }
  return noesis;
}

async function measure(files: number): Promise<number> {
  const noesis = await syntheticNoesis(files);
  try {
    const changes = new NoesisChangesRepository(noesis);
    const indexer = new IndexService(db, {
      changes,
      topics: createTopicsStore(noesis),
      decisions: createDecisionsStore(noesis),
      systemModels: createSystemModelStore(noesis),
    });
    const report = await indexer.rebuild();
    expect(report.files).toBe(files);
    return report.durationMs;
  } finally {
    await rm(noesis.root, { recursive: true, force: true });
  }
}

describe('boot re-index benchmark', () => {
  it('indexes 1k files', async () => {
    console.log(`[bench] 1k files: ${await measure(1_000)} ms`);
  }, 120_000);

  it('indexes 10k files within the working budget', async () => {
    const ms = await measure(10_000);
    console.log(`[bench] 10k files: ${ms} ms (budget ${BUDGET_MS_AT_10K} ms)`);
    expect(ms).toBeLessThan(BUDGET_MS_AT_10K);
  }, 600_000);
});
