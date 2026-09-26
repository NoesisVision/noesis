import type { z } from 'zod';
import type { ChangeId } from '#backend/app/changes/change-id';
import type { ChangesService } from '#backend/app/changes/changes.service';
import { NotFoundError } from '#backend/app/not-found-error';
import { Serial } from '#backend/app/serial';
import { freeSlugId } from '#backend/app/slug-id';
import type { Today } from '#backend/app/today';
import {
  type CreateDesignDoc,
  DesignDoc,
  type DesignDocViolation,
  type UpdateDesignDoc,
} from './design-doc';
import { DesignDocId } from './design-doc-id';
import type { DesignDocsRepository } from './design-docs.repository';

/** What callers get back: plain data, so every adapter can send it as is. */
export const DesignDocSummary = DesignDoc.pick({
  id: true,
  name: true,
  implemented: true,
});
export type DesignDocSummary = z.infer<typeof DesignDocSummary>;

/** A design document an agent wrote breaks the rules of `DesignDoc.validateAgentGenerated`. */
export class InvalidDesignDocError extends Error {
  readonly violations: DesignDocViolation[];

  constructor(violations: DesignDocViolation[]) {
    super(
      `The design document breaks its rules:\n${violations
        .map(({ path, reason }) => `- ${path}: ${reason}`)
        .join('\n')}`,
    );
    this.name = 'InvalidDesignDocError';
    this.violations = violations;
  }
}

/**
 * Callers validate before calling in. The service mints the id of a new
 * document; an update names it. Every write comes from an agent, so each is
 * checked against the rules for a design an agent wrote first.
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
    document: CreateDesignDoc,
  ): Promise<DesignDocSummary> {
    return this.writes.run(async () => {
      await this.changesService.assertExists(change);
      assertValid(document);
      const id = await freeSlugId(
        DesignDocId,
        document.name,
        this.today(),
        async (candidate) => (await this.docs.get(change, candidate)) !== null,
      );
      const created: DesignDoc = { id, ...document };
      await this.docs.save(change, created);
      return summarize(created);
    });
  }

  /**
   * Replaces the design document at `id` whole; never creates one. Throws
   * `InvalidDesignDocError` when the new version breaks the rules.
   */
  update(
    change: ChangeId,
    id: DesignDocId,
    document: UpdateDesignDoc,
  ): Promise<DesignDocSummary> {
    return this.writes.run(async () => {
      await this.getOrThrow(change, id);
      assertValid(document);
      const updated: DesignDoc = { id, ...document };
      await this.docs.save(change, updated);
      return summarize(updated);
    });
  }

  /** Oldest first: the id starts with the creation date. */
  async list(change: ChangeId): Promise<DesignDocSummary[]> {
    await this.changesService.assertExists(change);
    return (await this.docs.list(change)).map(summarize);
  }

  findById(change: ChangeId, id: DesignDocId): Promise<DesignDoc> {
    return this.getOrThrow(change, id);
  }

  /** The change is checked first, so a missing change is the one named. */
  private async getOrThrow(
    change: ChangeId,
    id: DesignDocId,
  ): Promise<DesignDoc> {
    await this.changesService.assertExists(change);
    const document = await this.docs.get(change, id);
    if (document === null)
      throw new NotFoundError('design document', id, change);
    return document;
  }
}

function summarize({ id, name, implemented }: DesignDoc): DesignDocSummary {
  return { id, name, implemented };
}

/** No system model is scanned yet, so every design is a green field. */
function assertValid(document: Omit<DesignDoc, 'id'>): void {
  const violations = DesignDoc.validateAgentGenerated(document);
  if (violations.length > 0) throw new InvalidDesignDocError(violations);
}
