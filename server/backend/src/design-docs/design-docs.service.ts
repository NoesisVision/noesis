import {
  checkDesignDocument,
  type DesignDocIssue,
  type DesignDocument,
  DesignDocumentSchema,
} from '@repo/shared-contracts';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import { newUuid } from '@repo/shared-contracts/uuid';
import { z } from 'zod';
import type { ChangesService } from '../changes/changes.service.js';
import type {
  DesignDocsRepository,
  StoredDesignDoc,
} from './design-docs.repository.js';

/** What a design document looks like in a list, without its content. */
export interface DesignDocSummary {
  id: string;
  name: string;
  status: string;
  date: string;
  updatedAt: string;
}

export interface DesignDocDetail {
  summary: DesignDocSummary;
  document: DesignDocument;
}

/**
 * The incoming document failed the boundary validation — a malformed shape or
 * an integrity error. Carries what failed so the caller (a person retrying, or
 * later the agent's retry prompt) can see why.
 */
export class InvalidDesignDocumentError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Design document rejected: ${issues.join('; ')}`);
    this.name = 'InvalidDesignDocumentError';
    this.issues = issues;
  }
}

/**
 * Every write runs decision 51's boundary pipeline —
 * `DesignDocumentSchema.parse → checkDesignDocument` — so a document that
 * fails is a retry, never a stored inconsistency. The server mints the
 * document id (UUIDv7 — design docs are authored, not imported): whatever id
 * the input carries is replaced, so an agent inventing a colliding id cannot
 * overwrite anything.
 *
 * Documents are scoped to a change; every method throws
 * `ChangeNotFoundError` for a change that has no directory.
 */
export class DesignDocsService {
  private readonly designDocs: DesignDocsRepository;
  private readonly changes: ChangesService;

  constructor(designDocs: DesignDocsRepository, changes: ChangesService) {
    this.designDocs = designDocs;
    this.changes = changes;
  }

  async create(change: string, input: unknown): Promise<DesignDocSummary> {
    await this.changes.assertExists(change);
    const parsed = DesignDocumentSchema.safeParse(input);
    if (!parsed.success) {
      throw new InvalidDesignDocumentError([z.prettifyError(parsed.error)]);
    }
    const document: DesignDocument = { ...parsed.data, id: newUuid() };
    const errors = checkDesignDocument(document).filter(isError);
    if (errors.length > 0) {
      throw new InvalidDesignDocumentError(errors.map((i) => i.message));
    }

    return toSummary(await this.designDocs.create(change, document));
  }

  /**
   * The appointment-booking sample from shared-contracts, so a document can be
   * put in front of a reviewer before the agent writes real ones (phase 2 has
   * no other author). Stamped with today's date; the id is minted in `create`.
   */
  async createSample(change: string): Promise<DesignDocSummary> {
    return this.create(change, {
      ...designDocFixture,
      date: new Date().toISOString().slice(0, 10),
    });
  }

  async list(change: string): Promise<DesignDocSummary[]> {
    await this.changes.assertExists(change);
    return (await this.designDocs.list(change)).map(toSummary);
  }

  async findById(change: string, id: string): Promise<DesignDocDetail | null> {
    await this.changes.assertExists(change);
    const stored = await this.designDocs.findById(change, id);
    if (stored === null) return null;
    return { summary: toSummary(stored), document: stored.entity };
  }

  async delete(change: string, id: string): Promise<boolean> {
    await this.changes.assertExists(change);
    return this.designDocs.delete(change, id);
  }
}

const isError = (issue: DesignDocIssue): boolean => issue.severity === 'error';

function toSummary(stored: StoredDesignDoc): DesignDocSummary {
  const { id, name, status, date } = stored.entity;
  return { id, name, status, date, updatedAt: stored.updatedAt };
}
