import { ChangeOwnedRepository } from '#backend/adapters/out/store/change-owned.repository';
import { NoesisChangesRepository } from '#backend/adapters/out/store/changes.repository';
import { ChangesService } from '#backend/app/changes/changes.service';
import { DesignDoc } from '#backend/app/design-docs/design-doc';
import { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import { SourceDocument } from '#backend/app/information-sources/source-document';
import { SourceDocumentsService } from '#backend/app/information-sources/source-documents.service';
import { SearchService } from '#backend/app/search/search.service';
import { localToday } from '#backend/app/today';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** The application layer, shared by the MCP tools and the ui routes. */
export interface Services {
  changesService: ChangesService;
  designDocsService: DesignDocsService;
  documentsService: SourceDocumentsService;
  searchService: SearchService;
}

/** Wires the file repositories under `.noesis/` to the services that use them. */
export function createServices(noesis: NoesisDir): Services {
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
    localToday,
  );
  return {
    changesService,
    designDocsService: new DesignDocsService(
      designDocsRepository,
      changesService,
      localToday,
    ),
    documentsService: new SourceDocumentsService(
      documentsRepository,
      changesService,
      localToday,
    ),
    searchService: new SearchService(),
  };
}
