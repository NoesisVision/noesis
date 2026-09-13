import {
  type DesignDocument,
  DesignDocumentSchema,
} from '@repo/shared-contracts';
import type { ChangeSlug } from '../changes/change-slug.js';
import type { ChangesRepository } from '../changes/changes.repository.js';
import { FileRepository, type StoredFile } from '../files/file-repository.js';

export type StoredDesignDoc = StoredFile<DesignDocument>;

/**
 * The design documents of one change, as files under
 * `.noesis/graph/changes/<change>/design-docs/`, one `<slug>-<id-suffix>.json` per
 * document. A document arrives here already validated (schema parse +
 * integrity check in the service), so reading one back is a decode.
 */
export class DesignDocsRepository {
  private readonly changes: ChangesRepository;

  constructor(changes: ChangesRepository) {
    this.changes = changes;
  }

  async create(
    slug: ChangeSlug,
    document: DesignDocument,
  ): Promise<StoredDesignDoc> {
    return this.files(slug).write(document);
  }

  async findById(
    slug: ChangeSlug,
    id: string,
  ): Promise<StoredDesignDoc | null> {
    return this.files(slug).read(id);
  }

  /** Newest first — `date` drives ordering on the documents page (design-doc.ts). */
  async list(slug: ChangeSlug): Promise<StoredDesignDoc[]> {
    const stored = await this.files(slug).list();
    return stored.sort(
      (a, b) =>
        b.entity.date.localeCompare(a.entity.date) ||
        a.entity.name.localeCompare(b.entity.name),
    );
  }

  async delete(slug: ChangeSlug, id: string): Promise<boolean> {
    return this.files(slug).remove(id);
  }

  private files(slug: ChangeSlug): FileRepository<DesignDocument> {
    return new FileRepository<DesignDocument>({
      dir: this.changes.dirOf(slug, 'design-docs'),
      slugOf: (document) => document.name,
      decode: (raw) => DesignDocumentSchema.parse(raw),
    });
  }
}
