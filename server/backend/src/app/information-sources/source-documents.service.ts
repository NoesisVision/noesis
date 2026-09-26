import type { ChangeId } from '#backend/app/changes/change-id';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { Serial } from '#backend/app/serial';
import { freeSlugId } from '#backend/app/slug-id';
import type { Today } from '#backend/app/today';
import type { FindSourceDocumentByIdHandler } from './find-source-document-by-id';
import type {
  CreateSourceDocument,
  SourceDocument,
  UpdateSourceDocument,
} from './source-document';
import { SourceDocumentId } from './source-document-id';
import {
  type SourceDocumentSummary,
  summarize,
} from './source-document-summary';
import type { SourceDocumentsRepository } from './source-documents.repository';

/**
 * The commands on documents; the query handlers beside it answer the queries.
 * Callers validate before calling in. The service mints the id of a new
 * document; an update names it.
 */
export class SourceDocumentsService {
  private readonly docs: SourceDocumentsRepository;
  private readonly changesService: ChangesService;
  private readonly findById: FindSourceDocumentByIdHandler;
  private readonly today: Today;
  private readonly writes = new Serial();

  constructor(
    docs: SourceDocumentsRepository,
    changesService: ChangesService,
    findById: FindSourceDocumentByIdHandler,
    today: Today,
  ) {
    this.docs = docs;
    this.changesService = changesService;
    this.findById = findById;
    this.today = today;
  }

  /**
   * Creates the document in the change, at an id minted from today's date
   * and its title. A title already used that day in the change gets the next
   * free suffix.
   */
  create(
    change: ChangeId,
    document: CreateSourceDocument,
  ): Promise<SourceDocumentSummary> {
    return this.writes.run(async () => {
      await this.changesService.assertExists(change);
      const id = await freeSlugId(
        SourceDocumentId,
        document.title,
        this.today(),
        async (candidate) => (await this.docs.get(change, candidate)) !== null,
      );
      const created: SourceDocument = { id, ...document };
      await this.docs.save(change, created);
      return summarize(created);
    });
  }

  /** Replaces the document at `id` whole; never creates one. */
  update(
    change: ChangeId,
    id: SourceDocumentId,
    document: UpdateSourceDocument,
  ): Promise<SourceDocumentSummary> {
    return this.writes.run(async () => {
      await this.findById.execute({ change, id });
      const updated: SourceDocument = { id, ...document };
      await this.docs.save(change, updated);
      return summarize(updated);
    });
  }
}
