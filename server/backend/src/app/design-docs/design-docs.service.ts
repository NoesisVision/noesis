import { z } from 'zod';
import type { ChangeId } from '#backend/app/changes/change-id';
import type { ChangeOwnedRepository } from '#backend/app/changes/change-owned.repository';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { NotFoundError } from '#backend/app/not-found-error';
import { createAtFreeSlugId } from '#backend/app/slug-id';
import type { Today } from '#backend/app/today';
import { DesignDocument, type DesignDocumentContent } from './design-doc';
import type { DesignDocFieldAuthor } from './design-doc-field';
import { DesignDocId } from './design-doc-id';
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
  private readonly docs: ChangeOwnedRepository<DesignDocument>;
  private readonly changesService: ChangesService;
  private readonly today: Today;

  constructor(
    docs: ChangeOwnedRepository<DesignDocument>,
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
  async create(
    change: ChangeId,
    document: DesignDocumentContent,
  ): Promise<DesignDocSummary> {
    await this.changesService.assertExists(change);
    assertValid(document, 'agent');
    const at = (id: DesignDocId): DesignDocument => ({ id, ...document });
    const id = await createAtFreeSlugId(
      DesignDocId,
      document.name,
      this.today(),
      (candidate) => this.docs.create(change, at(candidate)),
    );
    return summarize(at(id));
  }

  /**
   * Replaces the design document at `id` whole; never creates one. Throws
   * `InvalidDesignDocError` when the new version breaks the rules `writer`
   * follows.
   */
  async update(
    change: ChangeId,
    id: DesignDocId,
    document: DesignDocumentContent,
    writer: DesignDocFieldAuthor,
  ): Promise<DesignDocSummary> {
    await this.getOrThrow(change, id);
    assertValid(document, writer);
    const updated: DesignDocument = { id, ...document };
    if (!(await this.docs.replace(change, updated))) {
      throw new NotFoundError('design document', id, change);
    }
    return summarize(updated);
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
