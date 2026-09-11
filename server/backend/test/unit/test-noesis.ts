import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChangesRepository } from '../../src/changes/changes.repository.js';
import { ChangesService } from '../../src/changes/changes.service.js';
import { DesignDocsRepository } from '../../src/design-docs/design-docs.repository.js';
import { DesignDocsService } from '../../src/design-docs/design-docs.service.js';
import { NoesisDir } from '../../src/files/noesis-dir.js';

/**
 * A throwaway repository root with an ensured `.noesis/`, plus the file-backed
 * services wired over it. Each spec makes its own, so the file system is the
 * isolation — there is no shared state to reset between tests.
 */
export interface TestNoesis {
  root: string;
  noesis: NoesisDir;
  changesRepository: ChangesRepository;
  changesService: ChangesService;
  designDocsService: DesignDocsService;
  cleanup(): Promise<void>;
}

export async function testNoesis(): Promise<TestNoesis> {
  const root = await mkdtemp(join(tmpdir(), 'noesis-test-'));
  const noesis = new NoesisDir(root);
  await noesis.ensure();
  const changesRepository = new ChangesRepository(noesis);
  const changesService = new ChangesService(changesRepository);
  return {
    root,
    noesis,
    changesRepository,
    changesService,
    designDocsService: new DesignDocsService(
      new DesignDocsRepository(changesRepository),
      changesService,
    ),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
