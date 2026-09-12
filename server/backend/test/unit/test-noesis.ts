import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChangesRepository } from '../../src/changes/changes.repository.js';
import { ChangesService } from '../../src/changes/changes.service.js';
import { DesignDocsRepository } from '../../src/design-docs/design-docs.repository.js';
import { DesignDocsService } from '../../src/design-docs/design-docs.service.js';
import { NoesisDir } from '../../src/files/noesis-dir.js';
import { ImportService } from '../../src/imports/import.service.js';
import type { IndexerSources } from '../../src/index/indexer.js';
import {
  ConversationsRepository,
  DocumentsRepository,
} from '../../src/sources/sources.repository.js';
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
  designDocsRepository: DesignDocsRepository;
  conversationsRepository: ConversationsRepository;
  documentsRepository: DocumentsRepository;
  topicsRepository: TopicsRepository;
  decisionsRepository: DecisionsRepository;
  /** The repositories as the indexer takes them. */
  sources: IndexerSources;
  changesService: ChangesService;
  designDocsService: DesignDocsService;
  importService: ImportService;
  cleanup(): Promise<void>;
}

export async function testNoesis(): Promise<TestNoesis> {
  const root = await mkdtemp(join(tmpdir(), 'noesis-test-'));
  const noesis = new NoesisDir(root);
  await noesis.ensure();
  const changesRepository = new ChangesRepository(noesis);
  const designDocsRepository = new DesignDocsRepository(changesRepository);
  const conversationsRepository = new ConversationsRepository(
    changesRepository,
  );
  const documentsRepository = new DocumentsRepository(changesRepository);
  const topicsRepository = new TopicsRepository(noesis);
  const decisionsRepository = new DecisionsRepository(noesis);
  const changesService = new ChangesService(changesRepository);
  return {
    root,
    noesis,
    changesRepository,
    designDocsRepository,
    conversationsRepository,
    documentsRepository,
    topicsRepository,
    decisionsRepository,
    sources: {
      changes: changesRepository,
      designDocs: designDocsRepository,
      conversations: conversationsRepository,
      documents: documentsRepository,
      topics: topicsRepository,
      decisions: decisionsRepository,
    },
    changesService,
    designDocsService: new DesignDocsService(
      designDocsRepository,
      changesService,
    ),
    importService: new ImportService({
      changes: changesService,
      conversations: conversationsRepository,
      documents: documentsRepository,
      topics: topicsRepository,
      decisions: decisionsRepository,
    }),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
