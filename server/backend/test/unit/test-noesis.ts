import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Change } from '@repo/shared-contracts';
import { ChangeSlug } from '../../src/changes/change-slug.js';
import { ChangesRepository } from '../../src/changes/changes.repository.js';
import { ChangesService } from '../../src/changes/changes.service.js';
import { DesignDocsService } from '../../src/design-docs/design-docs.service.js';
import { NoesisDir } from '../../src/files/noesis-dir.js';
import { ImportService } from '../../src/imports/import.service.js';
import type { IndexerSources } from '../../src/index/indexer.js';
import { SystemModelRepository } from '../../src/system-model/system-model.repository.js';
import {
  DecisionsRepository,
  TopicsRepository,
} from '../../src/wiki/wiki.repository.js';

/**
 * A throwaway repository root with an ensured `.noesis/`, plus the file-backed
 * repositories and services wired over it. Each spec makes its own, so the
 * file system is the isolation — there is no shared state to reset between
 * tests.
 */
export interface TestNoesis {
  root: string;
  noesis: NoesisDir;
  changesRepository: ChangesRepository;
  topicsRepository: TopicsRepository;
  decisionsRepository: DecisionsRepository;
  systemModelRepository: SystemModelRepository;
  /** The repositories as the indexer takes them. */
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
  const topicsRepository = new TopicsRepository(noesis);
  const decisionsRepository = new DecisionsRepository(noesis);
  const systemModelRepository = new SystemModelRepository(noesis);
  const changesService = new ChangesService(changesRepository);
  return {
    root,
    noesis,
    changesRepository,
    topicsRepository,
    decisionsRepository,
    systemModelRepository,
    sources: {
      changes: changesRepository,
      topics: topicsRepository,
      decisions: decisionsRepository,
      systemModels: systemModelRepository,
    },
    changesService,
    designDocsService: new DesignDocsService(changesRepository, changesService),
    importService: new ImportService({
      changes: changesService,
      changesRepository,
      topics: topicsRepository,
      decisions: decisionsRepository,
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
