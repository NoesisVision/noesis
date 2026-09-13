import type { DesignDocument } from '@repo/shared-contracts';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import type { ChangeSlug } from '../changes/change-slug.js';
import type {
  ChangeChildren,
  ChangesRepository,
} from '../changes/changes.repository.js';
import type { ChangesService } from '../changes/changes.service.js';
import { dataFileOf } from '../files/noesis-store.js';
import { newUuid } from '../ids/uuid.js';
import { designDocumentContract } from '../mcp/contracts/design-document.js';
import { type ValidationIssue, validate } from '../validation/validator.js';

/** What a design document looks like in a list, without its content. */
export interface DesignDocSummary {
  id: string;
  name: string;
  status: string;
  date: string;
  /** The document's `data.json`, absolute — the agent reads it from there. */
  path: string;
}

/** `update` for an id the change has no document for. */
export class DesignDocNotFoundError extends Error {
  readonly id: string;

  constructor(slug: ChangeSlug, id: string) {
    super(`No design document ${JSON.stringify(id)} in change ${slug.value}.`);
    this.name = 'DesignDocNotFoundError';
    this.id = id;
  }
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
 * Documents are scoped to a change — the `design-docs` collection under it,
 * keyed by document id — and every method throws `ChangeNotFoundError` for a
 * slug no change has.
 */
export class DesignDocsService {
  private readonly changes: ChangesRepository;
  private readonly changesService: ChangesService;

  constructor(changes: ChangesRepository, changesService: ChangesService) {
    this.changes = changes;
    this.changesService = changesService;
  }

  async create(slug: ChangeSlug, input: unknown): Promise<DesignDocSummary> {
    await this.changesService.assertExists(slug);
    return this.accept(slug, input, newUuid());
  }

  /**
   * The appointment-booking sample from shared-contracts, so a document can be
   * put in front of a reviewer before the agent writes real ones (phase 2 has
   * no other author). Stamped with today's date; the id is minted in `create`.
   */
  async createSample(slug: ChangeSlug): Promise<DesignDocSummary> {
    return this.create(slug, {
      ...designDocFixture,
      date: new Date().toISOString().slice(0, 10),
    });
  }

  /**
   * Whole-document replacement (decision 51): the incoming document is
   * validated like a new one and replaces the stored file under the same id;
   * whatever id the input carries is ignored.
   */
  async update(
    slug: ChangeSlug,
    id: string,
    input: unknown,
  ): Promise<DesignDocSummary> {
    await this.changesService.assertExists(slug);
    if ((await this.docs(slug).get(id)) === null) {
      throw new DesignDocNotFoundError(slug, id);
    }
    return this.accept(slug, input, id);
  }

  /** Newest first — `date` drives ordering on the documents page. */
  async list(slug: ChangeSlug): Promise<DesignDocSummary[]> {
    await this.changesService.assertExists(slug);
    const documents = await Array.fromAsync(this.docs(slug).values());
    return documents
      .sort(
        (a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name),
      )
      .map((document) => this.summarize(slug, document));
  }

  async findById(
    slug: ChangeSlug,
    id: string,
  ): Promise<DesignDocDetail | null> {
    await this.changesService.assertExists(slug);
    const document = await this.docs(slug).get(id);
    if (document === null) return null;
    return { summary: this.summarize(slug, document), document };
  }

  async delete(slug: ChangeSlug, id: string): Promise<boolean> {
    await this.changesService.assertExists(slug);
    return this.docs(slug).delete(id);
  }

  private docs(slug: ChangeSlug): ChangeChildren['design-docs'] {
    return this.changes.children(slug)['design-docs'];
  }

  /** The boundary: validates the input under the server's id, then stores it. */
  private async accept(
    slug: ChangeSlug,
    input: unknown,
    id: string,
  ): Promise<DesignDocSummary> {
    const report = validate(designDocumentContract, withId(input, id));
    if (!report.ok) {
      throw new InvalidDesignDocumentError(report.issues, report.suppressed);
    }
    await this.docs(slug).set(id, report.value);
    return this.summarize(slug, report.value);
  }

  private summarize(
    slug: ChangeSlug,
    document: DesignDocument,
  ): DesignDocSummary {
    const { id, name, status, date } = document;
    return { id, name, status, date, path: dataFileOf(this.docs(slug), id) };
  }
}

/** The server's id replaces whatever came in; a non-object is left for the schema to reject. */
function withId(input: unknown, id: string): unknown {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    ? { ...input, id }
    : input;
}
