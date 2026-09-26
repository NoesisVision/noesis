import { ChangeOwnedRepository } from '#backend/adapters/out/store/change-owned.repository';
import { NoesisChangesRepository } from '#backend/adapters/out/store/changes.repository';
import { ChangesService } from '#backend/app/changes/changes.service';
import { DesignDoc } from '#backend/app/design-docs/design-doc';
import { DesignDocsService } from '#backend/app/design-docs/design-docs.service';
import { CreateSourceDocumentHandler } from '#backend/app/information-sources/create-source-document';
import { FindSourceDocumentByIdHandler } from '#backend/app/information-sources/find-source-document-by-id';
import { ListSourceDocumentsForChangeHandler } from '#backend/app/information-sources/list-source-documents-for-change';
import { SourceDocument } from '#backend/app/information-sources/source-document';
import { UpdateSourceDocumentHandler } from '#backend/app/information-sources/update-source-document';
import { SearchService } from '#backend/app/search/search.service';
import { Serial } from '#backend/app/serial';
import { localToday } from '#backend/app/today';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** The application layer, shared by the MCP tools and the ui routes. */
export interface Services {
  changesService: ChangesService;
  designDocsService: DesignDocsService;
  createSourceDocument: CreateSourceDocumentHandler;
  updateSourceDocument: UpdateSourceDocumentHandler;
  listSourceDocumentsForChange: ListSourceDocumentsForChangeHandler;
  findSourceDocumentById: FindSourceDocumentByIdHandler;
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
  // One queue for every document write, so a create and an update never interleave.
  const documentWrites = new Serial();
  const findSourceDocumentById = new FindSourceDocumentByIdHandler(
    documentsRepository,
    changesService,
  );
  return {
    changesService,
    designDocsService: new DesignDocsService(
      designDocsRepository,
      changesService,
      localToday,
    ),
    createSourceDocument: new CreateSourceDocumentHandler(
      documentsRepository,
      changesService,
      documentWrites,
      localToday,
    ),
    updateSourceDocument: new UpdateSourceDocumentHandler(
      documentsRepository,
      changesService,
      documentWrites,
    ),
    listSourceDocumentsForChange: new ListSourceDocumentsForChangeHandler(
      documentsRepository,
      changesService,
    ),
    findSourceDocumentById,
    searchService: new SearchService(),
  };
}
