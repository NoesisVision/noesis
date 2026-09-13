import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Change } from '@repo/shared-contracts';
import { ChangeSlug } from '../../src/changes/change-slug.js';
import { ChangesRepository } from '../../src/changes/changes.repository.js';
import { ChangesService } from '../../src/changes/changes.service.js';
import { DesignDocsService } from '../../src/design-docs/design-docs.service.js';
import { NoesisDir } from '../../src/files/noesis-dir.js';
import type { NoesisStore } from '../../src/files/noesis-store.js';
import { ImportService } from '../../src/imports/import.service.js';
import type { IndexerSources } from '../../src/index/indexer.js';
import {
  createSystemModelStore,
  type SystemModelStore,
} from '../../src/system-model/system-model.store.js';
import {
  createDecisionsStore,
  createTopicsStore,
  type DecisionsStore,
  type TopicsStore,
} from '../../src/wiki/wiki.store.js';

/**
 * A throwaway repository root with an ensured `.noesis/`, plus the stores
 * and services wired over it. Each spec makes its own, so the
 * file system is the isolation — there is no shared state to reset between
 * tests.
 */
export interface TestNoesis {
  root: string;
  noesis: NoesisDir;
  changesRepository: ChangesRepository;
  topics: TopicsStore;
  decisions: DecisionsStore;
  systemModels: SystemModelStore;
  /** The stores as the indexer takes them. */
  sources: IndexerSources;
  changesService: ChangesService;
  designDocsService: DesignDocsService;
  importService: ImportService;
  /** Writes a change under `slug` with placeholder data; answers its slug. */
  createChange(
    slug: string | ChangeSlug,
    overrides?: Partial<Change>,
  ): Promise<ChangeSlug>;
  cleanup(): Promise<void>;
}

export async function testNoesis(): Promise<TestNoesis> {
  const root = await mkdtemp(join(tmpdir(), 'noesis-test-'));
  const noesis = new NoesisDir(root);
  await noesis.ensure();
  const changesRepository = new ChangesRepository(noesis);
  const topics = createTopicsStore(noesis);
  const decisions = createDecisionsStore(noesis);
  const systemModels = createSystemModelStore(noesis);
  const changesService = new ChangesService(changesRepository);
  return {
    root,
    noesis,
    changesRepository,
    topics,
    decisions,
    systemModels,
    sources: { changes: changesRepository, topics, decisions, systemModels },
    changesService,
    designDocsService: new DesignDocsService(changesRepository, changesService),
    importService: new ImportService({
      changes: changesService,
      changesRepository,
      topics,
      decisions,
    }),
    createChange: async (slug, overrides = {}) => {
      const parsed = typeof slug === 'string' ? ChangeSlug.parse(slug) : slug;
      const change: Change = {
        slug: parsed.value,
        name: parsed.value,
        key: '',
        type: 'chore',
        status: 'discovery',
        created_at: '2026-09-13T00:00:00.000Z',
        description: '',
        ...overrides,
      };
      await changesRepository.write(change);
      return parsed;
    },
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

/** Stores an entity under its own id. */
export function put<T extends { id: string }>(
  store: Pick<NoesisStore<T, unknown, unknown>, 'set'>,
  entity: T,
): Promise<void> {
  return store.set(entity.id, entity);
}

/** Every object of a collection, in key order. */
export async function all<T>(
  store: Pick<NoesisStore<unknown, T, unknown>, 'keys' | 'get'>,
): Promise<T[]> {
  const objects: T[] = [];
  for (const key of (await Array.fromAsync(store.keys())).sort()) {
    const object = await store.get(key);
    if (object !== null) objects.push(object);
  }
  return objects;
}
