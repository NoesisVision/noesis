import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IndexerSources } from '#backend/adapters/graph/index.service';
import { ImportService } from '#backend/adapters/mcp/import.service';
import { NoesisChangesRepository } from '#backend/adapters/store/changes.repository';
import { NoesisDesignDocsRepository } from '#backend/adapters/store/design-docs.repository';
import {
  createSystemModelStore,
  type SystemModelStore,
} from '#backend/adapters/store/system-model.store';
import {
  createDecisionsStore,
  createTopicsStore,
  type DecisionsStore,
  type TopicsStore,
} from '#backend/adapters/store/wiki.store';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import { ChangesService } from '#backend/app/changes/changes.service';
import type { Change } from '#backend/app/changes/model/change';
import { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import { NoesisDir } from '#backend/platform/files/noesis-dir';
import type { NoesisStore } from '#backend/platform/files/noesis-store';

// Each spec makes its own, so the file system is the isolation: there is no
// shared state to reset between tests.
export interface TestNoesis {
  root: string;
  noesis: NoesisDir;
  changesRepository: NoesisChangesRepository;
  topics: TopicsStore;
  decisions: DecisionsStore;
  systemModels: SystemModelStore;
  sources: IndexerSources;
  changesService: ChangesService;
  designDocsService: DesignDocsService;
  importService: ImportService;
  /** Writes a change with placeholder data. */
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
  const changesRepository = new NoesisChangesRepository(noesis);
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
    designDocsService: new DesignDocsService(
      new NoesisDesignDocsRepository(changesRepository),
      changesService,
    ),
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

export function put<T extends { id: string }>(
  store: Pick<NoesisStore<T, unknown, unknown>, 'set'>,
  entity: T,
): Promise<void> {
  return store.set(entity.id, entity);
}

/** Every object of a collection, in no particular order. */
export function all<T>(
  store: Pick<NoesisStore<unknown, T, unknown>, 'values'>,
): Promise<T[]> {
  return Array.fromAsync(store.values());
}
