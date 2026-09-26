import { NoesisChangesRepository } from '#backend/adapters/out/store/changes.repository';
import { addDesignDocToChangeHandler } from '#backend/app/changes/add-design-doc-to-change';
import { addSourceDocumentToChangeHandler } from '#backend/app/changes/add-source-document-to-change';
import { createChangeHandler } from '#backend/app/changes/create-change';
import { findChangeHandler } from '#backend/app/changes/find-change';
import { findDesignDocHandler } from '#backend/app/changes/find-design-doc';
import { findSourceDocumentHandler } from '#backend/app/changes/find-source-document';
import { listChangesHandler } from '#backend/app/changes/list-changes';
import { updateChangeHandler } from '#backend/app/changes/update-change';
import { updateDesignDocInChangeHandler } from '#backend/app/changes/update-design-doc-in-change';
import { updateSourceDocumentInChangeHandler } from '#backend/app/changes/update-source-document-in-change';
import { searchHandler } from '#backend/app/search/search';
import { localToday } from '#backend/app/today';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** Wires the change files under `.noesis/` to the handlers that use them. */
export function createServices(noesis: NoesisDir) {
  const changes = new NoesisChangesRepository(noesis);
  return {
    createChange: createChangeHandler(changes, localToday),
    updateChange: updateChangeHandler(changes),
    addDesignDocToChange: addDesignDocToChangeHandler(changes),
    updateDesignDocInChange: updateDesignDocInChangeHandler(changes),
    addSourceDocumentToChange: addSourceDocumentToChangeHandler(changes),
    updateSourceDocumentInChange: updateSourceDocumentInChangeHandler(changes),
    listChanges: listChangesHandler(changes),
    findChange: findChangeHandler(changes),
    findDesignDoc: findDesignDocHandler(changes),
    findSourceDocument: findSourceDocumentHandler(changes),
    search: searchHandler(),
  };
}

/** The application layer, shared by the MCP tools and the ui routes. */
export type Services = ReturnType<typeof createServices>;
