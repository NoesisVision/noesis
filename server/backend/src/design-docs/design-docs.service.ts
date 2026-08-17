import {
  checkDesignDocument,
  type DesignDocIssue,
  type DesignDocument,
  DesignDocumentSchema,
} from '@repo/shared-contracts';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import { newUuid } from '@repo/shared-contracts/uuid';
import { z } from 'zod';
import { seedYDocState } from './design-doc-editor.server.js';
import type {
  DesignDocSummaryRow,
  DesignDocsRepository,
} from './design-docs.repository.js';

/** What a design document looks like in a list, without its content. */
export interface DesignDocSummary {
  id: string;
  projectId: string;
  name: string;
  status: string;
  date: string;
  updatedAt: string;
}

export interface DesignDocDetail {
  summary: DesignDocSummary;
  document: DesignDocument;
}

export class DesignDocProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project ${projectId} not found`);
    this.name = 'DesignDocProjectNotFoundError';
  }
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
 * document id (UUIDv7), like projects: whatever id the input carries is
 * replaced, so an agent inventing a colliding id cannot overwrite anything.
 */
export class DesignDocsService {
  private readonly designDocs: DesignDocsRepository;

  constructor(designDocs: DesignDocsRepository) {
    this.designDocs = designDocs;
  }

  async create(projectId: string, input: unknown): Promise<DesignDocSummary> {
    const parsed = DesignDocumentSchema.safeParse(input);
    if (!parsed.success) {
      throw new InvalidDesignDocumentError([z.prettifyError(parsed.error)]);
    }
    const document: DesignDocument = { ...parsed.data, id: newUuid() };
    const errors = checkDesignDocument(document).filter(isError);
    if (errors.length > 0) {
      throw new InvalidDesignDocumentError(errors.map((i) => i.message));
    }

    const row = await this.designDocs.create(projectId, document);
    if (row === null) throw new DesignDocProjectNotFoundError(projectId);

    // Seed the Y.Doc exactly once, server-side, before any client can
    // connect (decision 51.6). From here on the Y.Doc is the editing truth
    // and the JSON column is the projection cache.
    await this.designDocs.saveState(document.id, seedYDocState(document));
    return toSummary(row);
  }

  /**
   * The appointment-booking sample from shared-contracts, so a document can be
   * put in front of a reviewer before the agent writes real ones (phase 2 has
   * no other author). Stamped with today's date; the id is minted in `create`.
   */
  async createSample(projectId: string): Promise<DesignDocSummary> {
    return this.create(projectId, {
      ...designDocFixture,
      date: new Date().toISOString().slice(0, 10),
    });
  }

  async listByProject(projectId: string): Promise<DesignDocSummary[]> {
    return (await this.designDocs.listByProject(projectId)).map(toSummary);
  }

  async findById(id: string): Promise<DesignDocDetail | null> {
    const row = await this.designDocs.findById(id);
    if (row === null) return null;
    return {
      summary: toSummary(row),
      // Stored documents passed the boundary pipeline, so this parse is a
      // decode, not a validation — a failure here is data corruption.
      document: DesignDocumentSchema.parse(JSON.parse(row.document)),
    };
  }

  async delete(id: string): Promise<boolean> {
    return this.designDocs.delete(id);
  }
}

const isError = (issue: DesignDocIssue): boolean => issue.severity === 'error';

function toSummary(row: DesignDocSummaryRow): DesignDocSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    status: row.status,
    date: row.date,
    updatedAt: row.updated_at,
  };
}
