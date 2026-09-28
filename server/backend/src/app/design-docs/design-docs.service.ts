import { z } from 'zod';
import type { ChangeId } from '#backend/app/changes/change-id';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { NotFoundError } from '#backend/app/not-found-error';
import { Serial } from '#backend/app/serial';
import { freeSlugId } from '#backend/app/slug-id';
import type { Today } from '#backend/app/today';
import { DesignDocument, type DesignDocumentContent } from './design-doc';
import type { DesignDocFieldAuthor } from './design-doc-field';
import { DesignDocId } from './design-doc-id';
import type { DesignDocsRepository } from './design-docs.repository';
import { InvalidDesignDocError } from './invalid-design-doc-error';

/** What callers get back: plain data, so every adapter can send it as is. */
export const DesignDocSummarySchema = z.object({
  id: DesignDocId,
  name: z.string().describe('The design document name, as stored.'),
  implemented: z
    .boolean()
    .describe('Whether the design is marked as implemented.'),
});
export type DesignDocSummary = z.infer<typeof DesignDocSummarySchema>;

/**
 * Callers validate before calling in. The service mints the id of a new
 * document; an update names it. Every write is checked against the rules for
 * whoever writes it: an agent creates, and an agent or a human revises.
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
   * free suffix. Throws `InvalidDesignDocError` when it breaks the rules.
   */
  create(
    change: ChangeId,
    document: DesignDocumentContent,
  ): Promise<DesignDocSummary> {
    return this.writes.run(async () => {
      await this.changesService.assertExists(change);
      assertValid(document, 'agent');
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

  /**
   * Replaces the design document at `id` whole; never creates one. Throws
   * `InvalidDesignDocError` when the new version breaks the rules `writer`
   * follows.
   */
  update(
    change: ChangeId,
    id: DesignDocId,
    document: DesignDocumentContent,
    writer: DesignDocFieldAuthor,
  ): Promise<DesignDocSummary> {
    return this.writes.run(async () => {
      await this.getOrThrow(change, id);
      assertValid(document, writer);
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

  findById(change: ChangeId, id: DesignDocId): Promise<DesignDocument> {
    return this.getOrThrow(change, id);
  }

  /** The change is checked first, so a missing change is the one named. */
  private async getOrThrow(
    change: ChangeId,
    id: DesignDocId,
  ): Promise<DesignDocument> {
    await this.changesService.assertExists(change);
    const document = await this.docs.get(change, id);
    if (document === null)
      throw new NotFoundError('design document', id, change);
    return document;
  }
}

function summarize({
  id,
  name,
  implemented,
}: DesignDocument): DesignDocSummary {
  return { id, name, implemented };
}

/** No system model is scanned yet, so every design is a green field. */
function assertValid(
  document: DesignDocumentContent,
  writer: DesignDocFieldAuthor,
): void {
  const violations =
    writer === 'agent'
      ? DesignDocument.validateAgentGenerated(document)
      : DesignDocument.validateHumanEdited(document);
  if (violations.length > 0) throw new InvalidDesignDocError(violations);
}
