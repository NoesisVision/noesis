import { z } from 'zod';
import type { ChangeId } from '#backend/app/changes/change-id';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { Serial } from '#backend/app/serial';
import { freeSlugId } from '#backend/app/slug-id';
import type { Today } from '#backend/app/today';
import type { DesignDocument, DesignDocumentContent } from './design-doc';
import { DesignDocId } from './design-doc-id';
import type { DesignDocsRepository } from './design-docs.repository';

/** What callers get back: plain data, so every adapter can send it as is. */
export const DesignDocSummarySchema = z.object({
  id: DesignDocId,
  name: z.string().describe('The design document name, as stored.'),
  implemented: z
    .boolean()
    .describe('Whether the design is marked as implemented.'),
});
export type DesignDocSummary = z.infer<typeof DesignDocSummarySchema>;

export interface DesignDocDetail {
  summary: DesignDocSummary;
  document: DesignDocument;
}

export class DesignDocNotFoundError extends Error {
  readonly change: ChangeId;
  readonly id: DesignDocId;

  constructor(change: ChangeId, id: DesignDocId) {
    super(
      `No design document ${JSON.stringify(id)} in change ${JSON.stringify(change)}.`,
    );
    this.name = 'DesignDocNotFoundError';
    this.change = change;
    this.id = id;
  }
}

/**
 * Callers validate before calling in. The service mints the id of a new
 * document; an update names it.
 */
export class DesignDocsService {
  private readonly docs: DesignDocsRepository;
  private readonly changesService: ChangesService;
  private readonly today: Today;
  private readonly writes = new Serial();

  constructor(
    docs: DesignDocsRepository,
    changesService: ChangesService,
    today: Today,
  ) {
    this.docs = docs;
    this.changesService = changesService;
    this.today = today;
  }

  /**
   * Creates the design document in the change, at an id minted from today's date
   * and its name. A name already used that day in the change gets the next
   * free suffix.
   */
  create(
    change: ChangeId,
    document: DesignDocumentContent,
  ): Promise<DesignDocSummary> {
    return this.writes.run(async () => {
      await this.changesService.assertExists(change);
      const id = await freeSlugId(
        DesignDocId,
        document.name,
        this.today(),
        async (candidate) => (await this.docs.get(change, candidate)) !== null,
      );
      const created: DesignDocument = { id, ...document };
      await this.docs.save(change, created);
      return summarize(created);
    });
  }

  /** Replaces the design document at `id` whole; never creates one. */
  update(
    change: ChangeId,
    id: DesignDocId,
    document: DesignDocumentContent,
  ): Promise<DesignDocSummary> {
    return this.writes.run(async () => {
      await this.changesService.assertExists(change);
      if ((await this.docs.get(change, id)) === null) {
        throw new DesignDocNotFoundError(change, id);
      }
      const updated: DesignDocument = { id, ...document };
      await this.docs.save(change, updated);
      return summarize(updated);
    });
  }

  /** Oldest first: the id starts with the creation date. */
  async list(change: ChangeId): Promise<DesignDocSummary[]> {
    await this.changesService.assertExists(change);
    return (await this.docs.list(change)).map(summarize);
  }

  async findById(
    change: ChangeId,
    id: DesignDocId,
  ): Promise<DesignDocDetail | null> {
    await this.changesService.assertExists(change);
    const document = await this.docs.get(change, id);
    if (document === null) return null;
    return { summary: summarize(document), document };
  }
}

function summarize({
  id,
  name,
  implemented,
}: DesignDocument): DesignDocSummary {
  return { id, name, implemented };
}
