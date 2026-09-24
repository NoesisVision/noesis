import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NoesisChangesRepository } from '#backend/adapters/store/changes.repository';
import { NoesisDesignDocsRepository } from '#backend/adapters/store/design-docs.repository';
import { NoesisDocumentsRepository } from '#backend/adapters/store/documents.repository';
import type { Change } from '#backend/app/changes/change';
import { ChangeId } from '#backend/app/changes/change-id';
import { ChangesService } from '#backend/app/changes/changes.service';
import {
  type DesignDocumentInput,
  DesignDocumentSchema,
} from '#backend/app/design-docs/design-doc';
import { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import {
  type DocumentInput,
  DocumentSchema,
} from '#backend/app/information-sources/document';
import { DocumentsService } from '#backend/app/information-sources/documents.service';
import { NoesisDir } from '#backend/platform/files/noesis-dir';

// Each spec makes its own, so the file system is the isolation: there is no
// shared state to reset between tests.
export interface TestNoesis {
  root: string;
  noesis: NoesisDir;
  changesRepository: NoesisChangesRepository;
  designDocsRepository: NoesisDesignDocsRepository;
  documentsRepository: NoesisDocumentsRepository;
  changesService: ChangesService;
  designDocsService: DesignDocsService;
  documentsService: DocumentsService;
  /** `graph/changes/`, where each change's file and folder sit. */
  changesDir: string;
  /** Writes a change with placeholder data. */
  createChange(
    id: string | ChangeId,
    overrides?: Partial<Change>,
  ): Promise<ChangeId>;
  /** Writes a design document into the change, bypassing the service. */
  writeDesignDoc(
    change: ChangeId,
    document: DesignDocumentInput,
  ): Promise<void>;
  /** Writes a document into the change, bypassing the service. */
  writeDocument(change: ChangeId, document: DocumentInput): Promise<void>;
  cleanup(): Promise<void>;
}

export async function testNoesis(): Promise<TestNoesis> {
  const root = await mkdtemp(join(tmpdir(), 'noesis-test-'));
  const noesis = new NoesisDir(root);
  await noesis.ensureInitialized();
  const changesRepository = new NoesisChangesRepository(noesis);
  const designDocsRepository = new NoesisDesignDocsRepository(noesis);
  const documentsRepository = new NoesisDocumentsRepository(noesis);
  const changesService = new ChangesService(
    changesRepository,
    designDocsRepository,
    documentsRepository,
  );
  return {
    root,
    noesis,
    changesRepository,
    designDocsRepository,
    documentsRepository,
    changesService,
    designDocsService: new DesignDocsService(
      designDocsRepository,
      changesService,
    ),
    documentsService: new DocumentsService(documentsRepository, changesService),
    changesDir: noesis.resolve('graph', 'changes'),
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
      await changesRepository.save(change);
      return parsed;
    },
    writeDesignDoc: (change, document) =>
      designDocsRepository.save(change, DesignDocumentSchema.parse(document)),
    writeDocument: (change, document) =>
      documentsRepository.save(change, DocumentSchema.parse(document)),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
