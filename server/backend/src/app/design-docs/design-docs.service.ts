import { v7 as uuidv7 } from 'uuid';
import type { ChangeSlug } from '#backend/app/changes/change-slug';
import type { ChangesService } from '#backend/app/changes/changes.service';
import type { DesignDocument, DesignDocumentInput } from './design-doc';
import type { DesignDocsRepository } from './design-docs.repository';

export interface DesignDocSummary {
  id: string;
  name: string;
  implemented: boolean;
  /** Absolute; the agent reads the document from there. */
  path: string;
}

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

/** What a summary is read from: the JSON form or the decoded document. */
type Summarizable = Pick<DesignDocumentInput, 'id' | 'name' | 'implemented'>;

/**
 * Callers validate before calling in. The server mints the id and
 * replaces whatever the input carries, so an agent inventing a colliding id
 * cannot overwrite another document.
 */
export class DesignDocsService {
  private readonly docs: DesignDocsRepository;
  private readonly changesService: ChangesService;

  constructor(docs: DesignDocsRepository, changesService: ChangesService) {
    this.docs = docs;
    this.changesService = changesService;
  }

  async create(
    slug: ChangeSlug,
    document: DesignDocumentInput,
  ): Promise<DesignDocSummary> {
    await this.changesService.assertExists(slug);
    return this.store(slug, document, uuidv7());
  }

  /** Whole-document replacement. */
  async update(
    slug: ChangeSlug,
    id: string,
    document: DesignDocumentInput,
  ): Promise<DesignDocSummary> {
    await this.changesService.assertExists(slug);
    if ((await this.docs.get(slug, id)) === null) {
      throw new DesignDocNotFoundError(slug, id);
    }
    return this.store(slug, document, id);
  }

  async list(slug: ChangeSlug): Promise<DesignDocSummary[]> {
    await this.changesService.assertExists(slug);
    const documents = await Array.fromAsync(this.docs.values(slug));
    return documents
      .map((document) => this.summarize(slug, document))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  async findById(
    slug: ChangeSlug,
    id: string,
  ): Promise<DesignDocDetail | null> {
    await this.changesService.assertExists(slug);
    const document = await this.docs.get(slug, id);
    if (document === null) return null;
    return { summary: this.summarize(slug, document), document };
  }

  async delete(slug: ChangeSlug, id: string): Promise<boolean> {
    await this.changesService.assertExists(slug);
    return this.docs.delete(slug, id);
  }

  private async store(
    slug: ChangeSlug,
    document: DesignDocumentInput,
    id: string,
  ): Promise<DesignDocSummary> {
    const stored = { ...document, id };
    await this.docs.set(slug, id, stored);
    return this.summarize(slug, stored);
  }

  private summarize(
    slug: ChangeSlug,
    { id, name, implemented }: Summarizable,
  ): DesignDocSummary {
    return {
      id,
      name: name.value,
      implemented: implemented ?? false,
      path: this.docs.pathOf(slug, id),
    };
  }
}
