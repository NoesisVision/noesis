import { NoesisChangesRepository } from '#backend/adapters/out/store/changes.repository';
import { AddDesignDocToChangeHandler } from '#backend/app/changes/add-design-doc-to-change';
import { AddSourceDocumentToChangeHandler } from '#backend/app/changes/add-source-document-to-change';
import { CreateChangeHandler } from '#backend/app/changes/create-change';
import { FindChangeHandler } from '#backend/app/changes/find-change';
import { FindDesignDocHandler } from '#backend/app/changes/find-design-doc';
import { FindSourceDocumentHandler } from '#backend/app/changes/find-source-document';
import { ListChangesHandler } from '#backend/app/changes/list-changes';
import { UpdateChangeHandler } from '#backend/app/changes/update-change';
import { UpdateDesignDocInChangeHandler } from '#backend/app/changes/update-design-doc-in-change';
import { UpdateSourceDocumentInChangeHandler } from '#backend/app/changes/update-source-document-in-change';
import { SearchService } from '#backend/app/search/search.service';
import { localToday } from '#backend/app/today';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** Wires the change files under `.noesis/` to the handlers that use them. */
export function createServices(noesis: NoesisDir) {
  const changes = new NoesisChangesRepository(noesis);
  return {
    createChange: new CreateChangeHandler(changes, localToday),
    updateChange: new UpdateChangeHandler(changes),
    addDesignDocToChange: new AddDesignDocToChangeHandler(changes),
    updateDesignDocInChange: new UpdateDesignDocInChangeHandler(changes),
    addSourceDocumentToChange: new AddSourceDocumentToChangeHandler(changes),
    updateSourceDocumentInChange: new UpdateSourceDocumentInChangeHandler(
      changes,
    ),
    listChanges: new ListChangesHandler(changes),
    findChange: new FindChangeHandler(changes),
    findDesignDoc: new FindDesignDocHandler(changes),
    findSourceDocument: new FindSourceDocumentHandler(changes),
    searchService: new SearchService(),
  };
}

/** The application layer, shared by the MCP tools and the ui routes. */
export type Services = ReturnType<typeof createServices>;
