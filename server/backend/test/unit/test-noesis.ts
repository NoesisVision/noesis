import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { z } from 'zod';
import { ChangeOwnedRepository } from '#backend/adapters/out/store/change-owned.repository';
import { NoesisChangesRepository } from '#backend/adapters/out/store/changes.repository';
import type { Change } from '#backend/app/changes/change';
import { ChangeId } from '#backend/app/changes/change-id';
import { ChangesService } from '#backend/app/changes/changes.service';
import {
  DesignDoc,
  type DesignDocInput,
} from '#backend/app/design-docs/design-doc';
import { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import { CreateSourceDocumentHandler } from '#backend/app/information-sources/create-source-document';
import { FindSourceDocumentByIdHandler } from '#backend/app/information-sources/find-source-document-by-id';
import { ListSourceDocumentsForChangeHandler } from '#backend/app/information-sources/list-source-documents-for-change';
import { SourceDocument } from '#backend/app/information-sources/source-document';
import { UpdateSourceDocumentHandler } from '#backend/app/information-sources/update-source-document';
import { Serial } from '#backend/app/serial';
import { NoesisDir } from '#backend/platform/files/noesis-dir';

/** The day every service in a spec mints its ids on. */
const TODAY = () => '2026-09-24';

// Each spec makes its own, so the file system is the isolation: there is no
// shared state to reset between tests.
export interface TestNoesis {
  root: string;
  noesis: NoesisDir;
  changesRepository: NoesisChangesRepository;
  designDocsRepository: ChangeOwnedRepository<DesignDoc>;
  documentsRepository: ChangeOwnedRepository<SourceDocument>;
  changesService: ChangesService;
  designDocsService: DesignDocsService;
  createSourceDocument: CreateSourceDocumentHandler;
  updateSourceDocument: UpdateSourceDocumentHandler;
  listSourceDocumentsForChange: ListSourceDocumentsForChangeHandler;
  findSourceDocumentById: FindSourceDocumentByIdHandler;
  /** `graph/changes/`, where each change's file and folder sit. */
  changesDir: string;
  /** Writes a change with placeholder data. */
  createChange(
    id: string | ChangeId,
    overrides?: Partial<Change>,
  ): Promise<ChangeId>;
  /** Writes a design document into the change, bypassing the service. */
  writeDesignDoc(change: ChangeId, document: DesignDocInput): Promise<void>;
  /** Writes a document into the change, bypassing the service. */
  writeDocument(
    change: ChangeId,
    document: z.input<typeof SourceDocument>,
  ): Promise<void>;
  cleanup(): Promise<void>;
}

export async function testNoesis(): Promise<TestNoesis> {
  const root = await mkdtemp(join(tmpdir(), 'noesis-test-'));
  const noesis = new NoesisDir(root);
  await noesis.ensureInitialized();
  const changesRepository = new NoesisChangesRepository(noesis);
  const designDocsRepository = new ChangeOwnedRepository(
    noesis,
    DesignDoc,
    'design-doc',
  );
  const documentsRepository = new ChangeOwnedRepository(
    noesis,
    SourceDocument,
    'document',
  );
  const changesService = new ChangesService(
    changesRepository,
    designDocsRepository,
    documentsRepository,
    TODAY,
  );
  // One queue for every document write, so a create and an update never interleave.
  const documentWrites = new Serial();
  const findSourceDocumentById = new FindSourceDocumentByIdHandler(
    documentsRepository,
    changesService,
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
      TODAY,
    ),
    createSourceDocument: new CreateSourceDocumentHandler(
      documentsRepository,
      changesService,
      documentWrites,
      TODAY,
    ),
    updateSourceDocument: new UpdateSourceDocumentHandler(
      documentsRepository,
      changesService,
      documentWrites,
    ),
    listSourceDocumentsForChange: new ListSourceDocumentsForChangeHandler(
      documentsRepository,
      changesService,
    ),
    findSourceDocumentById,
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
      designDocsRepository.save(change, DesignDoc.parse(document)),
    writeDocument: (change, document) =>
      documentsRepository.save(change, SourceDocument.parse(document)),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
