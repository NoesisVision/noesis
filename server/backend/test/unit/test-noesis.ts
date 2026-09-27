import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { z } from 'zod';
import { NoesisChangesRepository } from '#backend/adapters/out/store/changes.repository';
import { addDesignDocToChangeHandler } from '#backend/app/changes/add-design-doc-to-change';
import { addSourceDocumentToChangeHandler } from '#backend/app/changes/add-source-document-to-change';
import { createChangeHandler } from '#backend/app/changes/create-change';
import { findChangeHandler } from '#backend/app/changes/find-change';
import { findDesignDocHandler } from '#backend/app/changes/find-design-doc';
import { findSourceDocumentHandler } from '#backend/app/changes/find-source-document';
import { listChangesHandler } from '#backend/app/changes/list-changes';
import { Change } from '#backend/app/changes/model/change';
import { ChangeId } from '#backend/app/changes/model/change-id';
import { ChangeSnapshot } from '#backend/app/changes/model/change-snapshot';
import {
  DesignDoc,
  type DesignDocInput,
} from '#backend/app/changes/model/design-doc';
import { SourceDocument } from '#backend/app/changes/model/source-document';
import { updateChangeHandler } from '#backend/app/changes/update-change';
import { updateDesignDocInChangeHandler } from '#backend/app/changes/update-design-doc-in-change';
import { updateSourceDocumentInChangeHandler } from '#backend/app/changes/update-source-document-in-change';
import { searchHandler } from '#backend/app/search/search';
import type { Services } from '#backend/boot/services';
import { readJsonFile } from '#backend/platform/files/json-file';
import { NoesisDir } from '#backend/platform/files/noesis-dir';

/** The day every handler in a spec mints its ids on. */
const TODAY = () => '2026-09-24';

type ChangeFields = Omit<
  ChangeSnapshot,
  'id' | 'version' | 'designDocs' | 'sourceDocuments'
>;

// Each spec makes its own, so the file system is the isolation: there is no
// shared state to reset between tests.
export interface TestNoesis extends Services {
  root: string;
  noesis: NoesisDir;
  changesRepository: NoesisChangesRepository;
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

  const changesDir = noesis.resolve('graph', 'changes');
  const stored = (id: ChangeId): Promise<ChangeSnapshot> =>
    readJsonFile(join(changesDir, `${id}.change.json`), ChangeSnapshot);
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
    createChange: createChangeHandler(changesRepository, TODAY),
    updateChange: updateChangeHandler(changesRepository),
    addDesignDocToChange: addDesignDocToChangeHandler(changesRepository),
    updateDesignDocInChange: updateDesignDocInChangeHandler(changesRepository),
    addSourceDocumentToChange:
      addSourceDocumentToChangeHandler(changesRepository),
    updateSourceDocumentInChange:
      updateSourceDocumentInChangeHandler(changesRepository),
    listChanges: listChangesHandler(changesRepository),
    findChange: findChangeHandler(changesRepository),
    findDesignDoc: findDesignDocHandler(changesRepository),
    findSourceDocument: findSourceDocumentHandler(changesRepository),
    search: searchHandler(),
    changesDir,
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
