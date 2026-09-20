import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IndexerSources } from '#backend/adapters/graph/index.service';
import { NoesisChangesRepository } from '#backend/adapters/store/changes.repository';
import { NoesisDesignDocsRepository } from '#backend/adapters/store/design-docs.repository';
import {
  createSystemModelStore,
  type SystemModelStore,
} from '#backend/adapters/store/system-model.store';
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
  systemModels: SystemModelStore;
  sources: IndexerSources;
  changesService: ChangesService;
  designDocsService: DesignDocsService;
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
  await noesis.ensureInitialized();
  const changesRepository = new NoesisChangesRepository(noesis);
  const systemModels = createSystemModelStore(noesis);
  const changesService = new ChangesService(changesRepository);
  return {
    root,
    noesis,
    changesRepository,
    systemModels,
    sources: { changes: changesRepository, systemModels },
    changesService,
    designDocsService: new DesignDocsService(
      new NoesisDesignDocsRepository(changesRepository),
      changesService,
    ),
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

/** Every object of a collection, in no particular order. */
export function all<T>(
  store: Pick<NoesisStore<unknown, T, unknown>, 'values'>,
): Promise<T[]> {
  return Array.fromAsync(store.values());
}
