import { ChangeOwnedRepository } from '#backend/adapters/out/store/change-owned.repository';
import { NoesisChangesRepository } from '#backend/adapters/out/store/changes.repository';
import { ChangesService } from '#backend/app/changes/changes.service';
import { DesignDocument } from '#backend/app/design-docs/design-doc';
import { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import { DocumentSchema } from '#backend/app/information-sources/document';
import { DocumentsService } from '#backend/app/information-sources/documents.service';
import { SearchService } from '#backend/app/search/search.service';
import { localToday } from '#backend/app/today';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** The application layer, shared by the MCP tools and the ui routes. */
export interface Services {
  changesService: ChangesService;
  designDocsService: DesignDocsService;
  documentsService: DocumentsService;
  searchService: SearchService;
}

/** Wires the file repositories under `.noesis/` to the services that use them. */
export function createServices(noesis: NoesisDir): Services {
  const changesRepository = new NoesisChangesRepository(noesis);
  const designDocsRepository = new ChangeOwnedRepository(
    noesis,
    DesignDocument,
    'design-doc',
  );
  const documentsRepository = new ChangeOwnedRepository(
    noesis,
    DocumentSchema,
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
    documentsService: new DocumentsService(
      documentsRepository,
      changesService,
      localToday,
    ),
    searchService: new SearchService(),
  };
}
