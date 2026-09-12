import type { DesignDocument } from '@repo/shared-contracts';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import { newUuid } from '@repo/shared-contracts/uuid';
import type { ChangesService } from '../changes/changes.service.js';
import { designDocumentContract } from '../mcp/contracts/design-document.js';
import { type ValidationIssue, validate } from '../validation/validator.js';
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
 * an integrity error. Carries the validator's issue list so the caller (the
 * `create-design-doc` tool, or a 400 on the ui surface) can hand it on as is.
 */
export class InvalidDesignDocumentError extends Error {
  readonly issues: readonly ValidationIssue[];
  /** Issues beyond the validator's cap, counted but not listed. */
  readonly suppressed: number;

  constructor(issues: readonly ValidationIssue[], suppressed = 0) {
    super(
      `Design document rejected: ${issues.map((i) => `${i.path}: ${i.fix}`).join('; ')}`,
    );
    this.name = 'InvalidDesignDocumentError';
    this.issues = issues;
    this.suppressed = suppressed;
  }
}

/**
 * Every write runs decision 51's boundary pipeline —
 * `DesignDocumentSchema.parse → checkDesignDocument`, packaged as the
 * design-document contract the `validate` tool runs too — so a document that
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
    const report = validate(designDocumentContract, withMintedId(input));
    if (!report.ok) {
      throw new InvalidDesignDocumentError(report.issues, report.suppressed);
    }
    return toSummary(await this.designDocs.create(change, report.value));
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

/** The server's id replaces whatever came in; a non-object is left for the schema to reject. */
function withMintedId(input: unknown): unknown {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    ? { ...input, id: newUuid() }
    : input;
}

function toSummary(stored: StoredDesignDoc): DesignDocSummary {
  const { id, name, status, date } = stored.entity;
  return { id, name, status, date, updatedAt: stored.updatedAt };
}
