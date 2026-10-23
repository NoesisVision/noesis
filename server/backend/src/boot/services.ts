import { CSharpSourceCodeScanner } from '#backend/adapters/out/scanners/csharp/csharp.scanner';
import { DummySourceCodeScanner } from '#backend/adapters/out/scanners/dummy.scanner';
import { JavaSourceCodeScanner } from '#backend/adapters/out/scanners/java.scanner';
import { NoesisChangeOwnedRepository } from '#backend/adapters/out/store/change-owned.repository';
import { NoesisChangesRepository } from '#backend/adapters/out/store/changes.repository';
import { NoesisScannerSettingsRepository } from '#backend/adapters/out/store/scanner-settings.repository';
import { NoesisSystemModelsRepository } from '#backend/adapters/out/store/system-models.repository';
import { createChangeHandler } from '#backend/app/changes/create-change';
import { deleteChangeHandler } from '#backend/app/changes/delete-change';
import { findChangeHandler } from '#backend/app/changes/find-change';
import { listChangesHandler } from '#backend/app/changes/list-changes';
import { listChangesWithEntriesHandler } from '#backend/app/changes/list-changes-with-entries';
import { updateChangeHandler } from '#backend/app/changes/update-change';
import { localToday, type Now, type Today, utcNow } from '#backend/app/clock';
import { createDesignDocInChangeHandler } from '#backend/app/design-docs/create-design-doc-in-change';
import { findDesignDocHandler } from '#backend/app/design-docs/find-design-doc';
import { listDesignDocsInChangeHandler } from '#backend/app/design-docs/list-design-docs-in-change';
import { StoredDesignDocument } from '#backend/app/design-docs/stored-design-doc';
import { updateDesignDocInChangeHandler } from '#backend/app/design-docs/update-design-doc-in-change';
import { createDocumentInChangeHandler } from '#backend/app/information-sources/create-document-in-change';
import { deleteDocumentFromChangeHandler } from '#backend/app/information-sources/delete-document-from-change';
import { DocumentSchema } from '#backend/app/information-sources/document';
import { findDocumentHandler } from '#backend/app/information-sources/find-document';
import { listDocumentsInChangeHandler } from '#backend/app/information-sources/list-documents-in-change';
import { updateDocumentInChangeHandler } from '#backend/app/information-sources/update-document-in-change';
import { searchHandler } from '#backend/app/search/search';
import { findNewestSystemModelHandler } from '#backend/app/system-model/find-newest-system-model';
import { scanSystemModelHandler } from '#backend/app/system-model/scan-system-model';
import { ScannerFactory } from '#backend/app/system-model/scanner-factory';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/**
 * Wires the file repositories under `.noesis/` and the scanners to the
 * handlers that use them. `env` is where the scanner settings look for
 * `NOESIS_SCANNER`.
 */
export function createServices(
  noesis: NoesisDir,
  env: NodeJS.ProcessEnv = process.env,
  today: Today = localToday,
  now: Now = utcNow,
) {
  const changes = new NoesisChangesRepository(noesis);
  const designDocs = new NoesisChangeOwnedRepository(
    noesis,
    StoredDesignDocument,
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
      today,
      now,
    ),
    updateDesignDocInChange: updateDesignDocInChangeHandler(
      designDocs,
      changes,
      systemModels,
      now,
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
      new ScannerFactory(new NoesisScannerSettingsRepository(noesis, env), {
        dummy: () =>
          new DummySourceCodeScanner({ noesis, changes, designDocs, now }),
        java: () => new JavaSourceCodeScanner({ noesis, now }),
        csharp: (namespaces) =>
          new CSharpSourceCodeScanner({ noesis, now, namespaces }),
      }),
      systemModels,
    ),
    findNewestSystemModel: findNewestSystemModelHandler(systemModels),
  };
}

/** The application layer, shared by the MCP tools and the ui routes. */
export type Services = ReturnType<typeof createServices>;
