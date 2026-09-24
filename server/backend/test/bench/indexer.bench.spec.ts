// Boot re-index cost. Not part of `bun test test/unit`: run with
// `bun run test:bench`.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IndexService } from '#backend/adapters/graph/index.service';
import { SchemaService } from '#backend/adapters/graph/schema.service';
import { NoesisChangesRepository } from '#backend/adapters/store/changes.repository';
import { NoesisDesignDocsRepository } from '#backend/adapters/store/design-docs.repository';
import { NoesisDocumentsRepository } from '#backend/adapters/store/documents.repository';
import { createSystemModelStore } from '#backend/adapters/store/system-model.store';
import { ChangeId } from '#backend/app/changes/change-id';
import { DatabaseService } from '#backend/platform/database/database.service';
import { NoesisDir } from '#backend/platform/files/noesis-dir';
import { designDocFixture } from '../fixtures/design-doc.fixture';

const CHANGES = 20;
const BUDGET_MS_AT_10K = 2000;

let db: DatabaseService;

beforeAll(async () => {
  db = new DatabaseService();
  await db.init();
  await new SchemaService(db).ensureSchema();
});

afterAll(() => db.close());

interface BenchRepository {
  root: string;
  noesis: NoesisDir;
}

async function syntheticNoesis(files: number): Promise<BenchRepository> {
  const root = await mkdtemp(join(tmpdir(), 'noesis-bench-'));
  const noesis = new NoesisDir(root);
  await noesis.ensureInitialized();
  const changes = new NoesisChangesRepository(noesis);
  const folderOf = (change: ChangeId) =>
    noesis.resolve('graph', 'changes', change);
  for (let c = 0; c < CHANGES; c++) {
    const change = ChangeId.parse(`2026-01-01-change-${c}`);
    await changes.save({
      id: change,
      name: change,
      key: '',
      type: 'chore',
      status: 'discovery',
      description: '',
    });
    await mkdir(folderOf(change), { recursive: true });
  }
  for (let i = 0; i < files; i++) {
    const id = `2026-01-01-design-doc-${i}`;
    const name = `Design doc ${i}`;
    const change = ChangeId.parse(`2026-01-01-change-${i % CHANGES}`);
    await writeFile(
      join(folderOf(change), `${id}.design-doc.json`),
      JSON.stringify(
        { ...designDocFixture, id, name: { value: name } },
        null,
        2,
      ),
    );
  }
  return { root, noesis };
}

async function measure(files: number): Promise<number> {
  const { root, noesis } = await syntheticNoesis(files);
  try {
    const indexer = new IndexService(db, {
      changes: new NoesisChangesRepository(noesis),
      designDocs: new NoesisDesignDocsRepository(noesis),
      documents: new NoesisDocumentsRepository(noesis),
      systemModels: createSystemModelStore(noesis),
    });
    const report = await indexer.rebuild();
    expect(report.files).toBe(files);
    return report.durationMs;
  } finally {
    await rm(root, { recursive: true, force: true });
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
