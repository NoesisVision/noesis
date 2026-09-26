import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { z } from 'zod';
import { NoesisChangesRepository } from '#backend/adapters/out/store/changes.repository';
import { AddDesignDocToChangeHandler } from '#backend/app/changes/add-design-doc-to-change';
import { AddSourceDocumentToChangeHandler } from '#backend/app/changes/add-source-document-to-change';
import { CreateChangeHandler } from '#backend/app/changes/create-change';
import { FindChangeHandler } from '#backend/app/changes/find-change';
import { FindDesignDocHandler } from '#backend/app/changes/find-design-doc';
import { FindSourceDocumentHandler } from '#backend/app/changes/find-source-document';
import { ListChangesHandler } from '#backend/app/changes/list-changes';
import { Change } from '#backend/app/changes/model/change';
import { ChangeId } from '#backend/app/changes/model/change-id';
import type { ChangeSnapshot } from '#backend/app/changes/model/change-snapshot';
import {
  DesignDoc,
  type DesignDocInput,
} from '#backend/app/changes/model/design-doc';
import { SourceDocument } from '#backend/app/changes/model/source-document';
import { UpdateChangeHandler } from '#backend/app/changes/update-change';
import { UpdateDesignDocInChangeHandler } from '#backend/app/changes/update-design-doc-in-change';
import { UpdateSourceDocumentInChangeHandler } from '#backend/app/changes/update-source-document-in-change';
import { SearchService } from '#backend/app/search/search.service';
import { NoesisDir } from '#backend/platform/files/noesis-dir';

/** The day every handler in a spec mints its ids on. */
const TODAY = () => '2026-09-24';

type ChangeFields = Omit<
  ChangeSnapshot,
  'id' | 'version' | 'designDocs' | 'sourceDocuments'
>;

// Each spec makes its own, so the file system is the isolation: there is no
// shared state to reset between tests.
export interface TestNoesis {
  root: string;
  noesis: NoesisDir;
  changesRepository: NoesisChangesRepository;
  createChange: CreateChangeHandler;
  updateChange: UpdateChangeHandler;
  addDesignDocToChange: AddDesignDocToChangeHandler;
  updateDesignDocInChange: UpdateDesignDocInChangeHandler;
  addSourceDocumentToChange: AddSourceDocumentToChangeHandler;
  updateSourceDocumentInChange: UpdateSourceDocumentInChangeHandler;
  listChanges: ListChangesHandler;
  findChange: FindChangeHandler;
  findDesignDoc: FindDesignDocHandler;
  findSourceDocument: FindSourceDocumentHandler;
  searchService: SearchService;
  /** `graph/changes/`, where each change's file sits. */
  changesDir: string;
  /** Writes a change with placeholder data, bypassing the handlers. */
  writeChange(
    id: string | ChangeId,
    overrides?: Partial<ChangeFields>,
  ): Promise<ChangeId>;
  /** Writes a design document into the change, bypassing the handlers. */
  writeDesignDoc(change: ChangeId, document: DesignDocInput): Promise<void>;
  /** Writes a document into the change, bypassing the handlers. */
  writeDocument(
    change: ChangeId,
    document: z.input<typeof SourceDocument>,
  ): Promise<void>;
  /** The change as stored, whole. */
  stored(change: ChangeId): Promise<ChangeSnapshot>;
  cleanup(): Promise<void>;
}

export async function testNoesis(): Promise<TestNoesis> {
  const root = await mkdtemp(join(tmpdir(), 'noesis-test-'));
  const noesis = new NoesisDir(root);
  await noesis.ensureInitialized();
  const changesRepository = new NoesisChangesRepository(noesis);

  const stored = async (id: ChangeId): Promise<ChangeSnapshot> => {
    const change = await changesRepository.get(id);
    if (change === null) throw new Error(`no change ${id}`);
    return change.toSnapshot();
  };
  const own = async (
    id: ChangeId,
    add: (snapshot: ChangeSnapshot) => ChangeSnapshot,
  ): Promise<void> => {
    await changesRepository.save(Change.fromSnapshot(add(await stored(id))));
  };

  return {
    root,
    noesis,
    changesRepository,
    createChange: new CreateChangeHandler(changesRepository, TODAY),
    updateChange: new UpdateChangeHandler(changesRepository),
    addDesignDocToChange: new AddDesignDocToChangeHandler(changesRepository),
    updateDesignDocInChange: new UpdateDesignDocInChangeHandler(
      changesRepository,
    ),
    addSourceDocumentToChange: new AddSourceDocumentToChangeHandler(
      changesRepository,
    ),
    updateSourceDocumentInChange: new UpdateSourceDocumentInChangeHandler(
      changesRepository,
    ),
    listChanges: new ListChangesHandler(changesRepository),
    findChange: new FindChangeHandler(changesRepository),
    findDesignDoc: new FindDesignDocHandler(changesRepository),
    findSourceDocument: new FindSourceDocumentHandler(changesRepository),
    searchService: new SearchService(),
    changesDir: noesis.resolve('graph', 'changes'),
    writeChange: async (id, overrides = {}) => {
      const parsed = ChangeId.parse(id);
      const change = Change.create(parsed, {
        name: parsed,
        key: '',
        type: 'chore',
        description: '',
      });
      change.update({ ...change.summary(), ...overrides });
      await changesRepository.save(change);
      return parsed;
    },
    writeDesignDoc: (change, document) =>
      own(change, (snapshot) => ({
        ...snapshot,
        designDocs: [...snapshot.designDocs, DesignDoc.parse(document)],
      })),
    writeDocument: (change, document) =>
      own(change, (snapshot) => ({
        ...snapshot,
        sourceDocuments: [
          ...snapshot.sourceDocuments,
          SourceDocument.parse(document),
        ],
      })),
    stored,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
