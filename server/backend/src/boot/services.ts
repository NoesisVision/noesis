import { GitSourceRepository } from '#backend/adapters/out/scanner/git-source-repository';
import { ServerScanLog } from '#backend/adapters/out/scanner/server-scan-log';
import { ChangesFileRepository } from '#backend/adapters/out/store/changes.repository';
import { DesignDocsFileRepository } from '#backend/adapters/out/store/design-docs.repository';
import { DocumentsFileRepository } from '#backend/adapters/out/store/documents.repository';
import { ScannerSettingsFileRepository } from '#backend/adapters/out/store/scanner-settings.repository';
import { SystemModelsFileRepository } from '#backend/adapters/out/store/system-models.repository';
import { createChangeHandler } from '#backend/app/changes/create-change';
import { deleteChangeHandler } from '#backend/app/changes/delete-change';
import { findChangeHandler } from '#backend/app/changes/find-change';
import { listChangesHandler } from '#backend/app/changes/list-changes';
import { listChangesWithEntriesHandler } from '#backend/app/changes/list-changes-with-entries';
import { updateChangeHandler } from '#backend/app/changes/update-change';
import { type Clock, systemClock } from '#backend/app/clock';
import { createDesignDocInChangeHandler } from '#backend/app/design-docs/create-design-doc-in-change';
import { findDesignDocHandler } from '#backend/app/design-docs/find-design-doc';
import { listDesignDocsInChangeHandler } from '#backend/app/design-docs/list-design-docs-in-change';
import { updateDesignDocInChangeHandler } from '#backend/app/design-docs/update-design-doc-in-change';
import { createDocumentInChangeHandler } from '#backend/app/information-sources/create-document-in-change';
import { deleteDocumentFromChangeHandler } from '#backend/app/information-sources/delete-document-from-change';
import { findDocumentHandler } from '#backend/app/information-sources/find-document';
import { listDocumentsInChangeHandler } from '#backend/app/information-sources/list-documents-in-change';
import { updateDocumentInChangeHandler } from '#backend/app/information-sources/update-document-in-change';
import { scanSystemModelHandler } from '#backend/app/scanner/scan-system-model';
import { ScannerFactory } from '#backend/app/scanner/scanner-factory';
import { findNewestSystemModelHandler } from '#backend/app/scanner/system-model/find-newest-system-model';
import { searchHandler } from '#backend/app/search/search';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { codeParsers } from './code-parsers';

/**
 * Wires the file repositories under `.noesis/` and the scanners to the
 * handlers that use them.
 */
export function createServices(noesis: NoesisDir, clock: Clock = systemClock) {
  const changes = new ChangesFileRepository(noesis);
  const designDocs = new DesignDocsFileRepository(noesis);
  const documents = new DocumentsFileRepository(noesis);
  const systemModels = new SystemModelsFileRepository(noesis);
  return {
    createChange: createChangeHandler(changes, clock),
    updateChange: updateChangeHandler(changes),
    deleteChange: deleteChangeHandler(changes),
    listChanges: listChangesHandler(changes),
    listChangesWithEntries: listChangesWithEntriesHandler(
      changes,
      designDocs,
      documents,
    ),
    findChange: findChangeHandler(changes),
    createDesignDocInChange: createDesignDocInChangeHandler(
      designDocs,
      changes,
      systemModels,
      clock,
    ),
    updateDesignDocInChange: updateDesignDocInChangeHandler(
      designDocs,
      changes,
      systemModels,
      clock,
    ),
    listDesignDocsInChange: listDesignDocsInChangeHandler(designDocs, changes),
    findDesignDoc: findDesignDocHandler(designDocs, changes),
    createDocumentInChange: createDocumentInChangeHandler(
      documents,
      changes,
      clock,
    ),
    updateDocumentInChange: updateDocumentInChangeHandler(documents, changes),
    deleteDocumentFromChange: deleteDocumentFromChangeHandler(
      documents,
      changes,
    ),
    listDocumentsInChange: listDocumentsInChangeHandler(documents, changes),
    findDocument: findDocumentHandler(documents, changes),
    search: searchHandler(),
    scanSystemModel: scanSystemModelHandler(
      new ScannerFactory(
        new ScannerSettingsFileRepository(noesis),
        codeParsers(noesis),
        new GitSourceRepository(noesis.root),
        clock,
        new ServerScanLog(),
      ),
      systemModels,
    ),
    findNewestSystemModel: findNewestSystemModelHandler(systemModels),
  };
}

/** The application layer, shared by the MCP tools and the ui routes. */
export type Services = ReturnType<typeof createServices>;
