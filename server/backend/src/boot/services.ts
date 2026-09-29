import { NoesisChangeOwnedRepository } from '#backend/adapters/out/store/change-owned.repository';
import { NoesisChangesRepository } from '#backend/adapters/out/store/changes.repository';
import { createChangeHandler } from '#backend/app/changes/create-change';
import { findChangeHandler } from '#backend/app/changes/find-change';
import { listChangesHandler } from '#backend/app/changes/list-changes';
import { updateChangeHandler } from '#backend/app/changes/update-change';
import { createDesignDocInChangeHandler } from '#backend/app/design-docs/create-design-doc-in-change';
import { DesignDocument } from '#backend/app/design-docs/design-doc';
import { findDesignDocHandler } from '#backend/app/design-docs/find-design-doc';
import { updateDesignDocInChangeHandler } from '#backend/app/design-docs/update-design-doc-in-change';
import { createDocumentInChangeHandler } from '#backend/app/information-sources/create-document-in-change';
import { deleteDocumentFromChangeHandler } from '#backend/app/information-sources/delete-document-from-change';
import { DocumentSchema } from '#backend/app/information-sources/document';
import { findDocumentHandler } from '#backend/app/information-sources/find-document';
import { updateDocumentInChangeHandler } from '#backend/app/information-sources/update-document-in-change';
import { searchHandler } from '#backend/app/search/search';
import { localToday, type Today } from '#backend/app/today';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** Wires the file repositories under `.noesis/` to the handlers that use them. */
export function createServices(noesis: NoesisDir, today: Today = localToday) {
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
  return {
    createChange: createChangeHandler(changes, today),
    updateChange: updateChangeHandler(changes),
    listChanges: listChangesHandler(changes, designDocs, documents),
    findChange: findChangeHandler(changes, designDocs, documents),
    createDesignDocInChange: createDesignDocInChangeHandler(
      designDocs,
      changes,
      today,
    ),
    updateDesignDocInChange: updateDesignDocInChangeHandler(
      designDocs,
      changes,
    ),
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
    findDocument: findDocumentHandler(documents, changes),
    search: searchHandler(),
  };
}

/** The application layer, shared by the MCP tools and the ui routes. */
export type Services = ReturnType<typeof createServices>;
