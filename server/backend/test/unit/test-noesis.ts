import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { z } from 'zod';
import { NoesisChangeOwnedRepository } from '#backend/adapters/out/store/change-owned.repository';
import { NoesisChangesRepository } from '#backend/adapters/out/store/changes.repository';
import type { Change } from '#backend/app/changes/change';
import { ChangeId } from '#backend/app/changes/change-id';
import {
  DesignDocument,
  type DesignDocumentInput,
} from '#backend/app/design-docs/design-doc';
import {
  type Document,
  DocumentSchema,
} from '#backend/app/information-sources/document';
import { createServices, type Services } from '#backend/boot/services';
import { NoesisDir } from '#backend/platform/files/noesis-dir';

/** The day every handler in a spec mints its ids on. */
const TODAY = () => '2026-09-24';

// Each spec makes its own, so the file system is the isolation: there is no
// shared state to reset between tests.
export interface TestNoesis extends Services {
  root: string;
  noesis: NoesisDir;
  changesRepository: NoesisChangesRepository;
  designDocsRepository: NoesisChangeOwnedRepository<DesignDocument>;
  documentsRepository: NoesisChangeOwnedRepository<Document>;
  /** `graph/changes/`, where each change's file and folder sit. */
  changesDir: string;
  /** Writes a change with placeholder data, bypassing the handlers. */
  writeChange(
    id: string | ChangeId,
    overrides?: Partial<Change>,
  ): Promise<ChangeId>;
  /** Writes a design document into the change, bypassing the handlers. */
  writeDesignDoc(
    change: ChangeId,
    document: DesignDocumentInput,
  ): Promise<void>;
  /** Writes a document into the change, bypassing the handlers. */
  writeDocument(
    change: ChangeId,
    document: z.input<typeof DocumentSchema>,
  ): Promise<void>;
  cleanup(): Promise<void>;
}

export async function testNoesis(): Promise<TestNoesis> {
  const root = await mkdtemp(join(tmpdir(), 'noesis-test-'));
  const noesis = new NoesisDir(root);
  await noesis.ensureInitialized();
  const changesRepository = new NoesisChangesRepository(noesis);
  const designDocsRepository = new NoesisChangeOwnedRepository(
    noesis,
    DesignDocument,
    'design-doc',
  );
  const documentsRepository = new NoesisChangeOwnedRepository(
    noesis,
    DocumentSchema,
    'document',
  );
  return {
    ...createServices(noesis, 'dummy', TODAY),
    root,
    noesis,
    changesRepository,
    designDocsRepository,
    documentsRepository,
    changesDir: noesis.resolve('graph', 'changes'),
    writeChange: async (id, overrides = {}) => {
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
      await changesRepository.create(change);
      return parsed;
    },
    writeDesignDoc: async (change, document) => {
      await designDocsRepository.create(change, DesignDocument.parse(document));
    },
    writeDocument: async (change, document) => {
      await documentsRepository.create(change, DocumentSchema.parse(document));
    },
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
