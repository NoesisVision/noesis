import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IndexerSources } from '#backend/adapters/graph/index.service';
import { NoesisChangesRepository } from '#backend/adapters/store/changes.repository';
import { NoesisDesignDocsRepository } from '#backend/adapters/store/design-docs.repository';
import { NoesisDocumentsRepository } from '#backend/adapters/store/documents.repository';
import {
  createSystemModelStore,
  type SystemModelStore,
} from '#backend/adapters/store/system-model.store';
import type { Change } from '#backend/app/changes/change';
import { ChangeId } from '#backend/app/changes/change-id';
import { ChangesService } from '#backend/app/changes/changes.service';
import { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import { DocumentsService } from '#backend/app/information-sources/documents.service';
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
  documentsService: DocumentsService;
  /** Writes a change with placeholder data. */
  createChange(
    id: string | ChangeId,
    overrides?: Partial<Change>,
  ): Promise<ChangeId>;
  cleanup(): Promise<void>;
}

export async function testNoesis(): Promise<TestNoesis> {
  const root = await mkdtemp(join(tmpdir(), 'noesis-test-'));
  const noesis = new NoesisDir(root);
  await noesis.ensureInitialized();
  const changesRepository = new NoesisChangesRepository(noesis);
  const designDocsRepository = new NoesisDesignDocsRepository(
    changesRepository,
  );
  const documentsRepository = new NoesisDocumentsRepository(changesRepository);
  const systemModels = createSystemModelStore(noesis);
  const changesService = new ChangesService(
    changesRepository,
    designDocsRepository,
    documentsRepository,
  );
  return {
    root,
    noesis,
    changesRepository,
    systemModels,
    sources: { changes: changesRepository, systemModels },
    changesService,
    designDocsService: new DesignDocsService(
      designDocsRepository,
      changesService,
    ),
    documentsService: new DocumentsService(documentsRepository, changesService),
    createChange: async (id, overrides = {}) => {
      const parsed = ChangeId.parse(id);
      const change: Change = {
        id: parsed,
        name: parsed,
        key: '',
        type: 'chore',
        status: 'discovery',
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
