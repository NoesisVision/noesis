import { dataFileOf } from '../../platform/files/noesis-store.js';
import { designDocFixture } from '../../shared/contracts/design-doc.fixture.js';
import type { DesignDocument } from '../../shared/contracts/index.js';
import { newUuid } from '../../shared/vo/uuid.js';
import type { ChangeSlug } from '../changes/change-slug.js';
import type {
  ChangeChildren,
  ChangesRepository,
} from '../changes/changes.repository.js';
import type { ChangesService } from '../changes/changes.service.js';

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
 * Takes documents that already passed decision D4's boundary pipeline
 * (`DesignDocumentSchema.parse → checkDesignDocument`, the design-document
 * contract): the ui route and the MCP tool validate before calling in, and
 * the store parses the schema once more on write. The server mints the
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

  async create(
    slug: ChangeSlug,
    document: DesignDocument,
  ): Promise<DesignDocSummary> {
    await this.changesService.assertExists(slug);
    return this.store(slug, document, newUuid());
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
   * Whole-document replacement (decision D4): the incoming document replaces
   * the stored file under the same id; whatever id the input carries is
   * ignored.
   */
  async update(
    slug: ChangeSlug,
    id: string,
    document: DesignDocument,
  ): Promise<DesignDocSummary> {
    await this.changesService.assertExists(slug);
    if ((await this.docs(slug).get(id)) === null) {
      throw new DesignDocNotFoundError(slug, id);
    }
    return this.store(slug, document, id);
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

  /** Stores the document under the server's id, replacing whatever id it carried. */
  private async store(
    slug: ChangeSlug,
    document: DesignDocument,
    id: string,
  ): Promise<DesignDocSummary> {
    const stored = { ...document, id };
    await this.docs(slug).set(id, stored);
    return this.summarize(slug, stored);
  }

  private summarize(
    slug: ChangeSlug,
    document: DesignDocument,
  ): DesignDocSummary {
    const { id, name, status, date } = document;
    return { id, name, status, date, path: dataFileOf(this.docs(slug), id) };
  }
}
