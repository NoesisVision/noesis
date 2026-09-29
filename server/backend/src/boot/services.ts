import { createScanner } from '#backend/adapters/out/scanners/scanners';
import { NoesisChangeOwnedRepository } from '#backend/adapters/out/store/change-owned.repository';
import { NoesisChangesRepository } from '#backend/adapters/out/store/changes.repository';
import { NoesisSystemModelsRepository } from '#backend/adapters/out/store/system-models.repository';
import { createChangeHandler } from '#backend/app/changes/create-change';
import { findChangeHandler } from '#backend/app/changes/find-change';
import { listChangesHandler } from '#backend/app/changes/list-changes';
import { listChangesWithEntriesHandler } from '#backend/app/changes/list-changes-with-entries';
import { updateChangeHandler } from '#backend/app/changes/update-change';
import { createDesignDocInChangeHandler } from '#backend/app/design-docs/create-design-doc-in-change';
import { DesignDocument } from '#backend/app/design-docs/design-doc';
import { findDesignDocHandler } from '#backend/app/design-docs/find-design-doc';
import { listDesignDocsInChangeHandler } from '#backend/app/design-docs/list-design-docs-in-change';
import { updateDesignDocInChangeHandler } from '#backend/app/design-docs/update-design-doc-in-change';
import { createDocumentInChangeHandler } from '#backend/app/information-sources/create-document-in-change';
import { deleteDocumentFromChangeHandler } from '#backend/app/information-sources/delete-document-from-change';
import { DocumentSchema } from '#backend/app/information-sources/document';
import { findDocumentHandler } from '#backend/app/information-sources/find-document';
import { listDocumentsInChangeHandler } from '#backend/app/information-sources/list-documents-in-change';
import { updateDocumentInChangeHandler } from '#backend/app/information-sources/update-document-in-change';
import { searchHandler } from '#backend/app/search/search';
import { scanSystemModelHandler } from '#backend/app/system-model/scan-system-model';
import { localToday, type Today } from '#backend/app/today';
import type { ScannerName } from '#backend/platform/config/config';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/**
 * Wires the file repositories under `.noesis/`, and the scanner `scanner`
 * names, to the handlers that use them.
 */
export function createServices(
  noesis: NoesisDir,
  scanner: ScannerName,
  today: Today = localToday,
) {
  const changes = new NoesisChangesRepository(noesis);
  const designDocs = new NoesisChangeOwnedRepository(
    noesis,
    DesignDocument,
    'design-doc',
  );
  const documents = new NoesisChangeOwnedRepository(
    noesis,
    DocumentSchema,
    'document',
  );
  const systemModels = new NoesisSystemModelsRepository(noesis);
  return {
    createChange: createChangeHandler(changes, today),
    updateChange: updateChangeHandler(changes),
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
      today,
    ),
    updateDesignDocInChange: updateDesignDocInChangeHandler(
      designDocs,
      changes,
    ),
    listDesignDocsInChange: listDesignDocsInChangeHandler(designDocs, changes),
    findDesignDoc: findDesignDocHandler(designDocs, changes),
    createDocumentInChange: createDocumentInChangeHandler(
      documents,
      changes,
      today,
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
      createScanner(scanner),
      systemModels,
    ),
  };
}

/** The application layer, shared by the MCP tools and the ui routes. */
export type Services = ReturnType<typeof createServices>;
