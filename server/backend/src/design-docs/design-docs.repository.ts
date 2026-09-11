import {
  type DesignDocument,
  DesignDocumentSchema,
} from '@repo/shared-contracts';
import type { ChangesRepository } from '../changes/changes.repository.js';
import { FileRepository, type StoredFile } from '../files/file-repository.js';

export type StoredDesignDoc = StoredFile<DesignDocument>;

/**
 * The design documents of one change, as files under
 * `.noesis/changes/<change>/design-docs/`, one `<slug>-<id-suffix>.json` per
 * document. A document arrives here already validated (schema parse +
 * integrity check in the service), so reading one back is a decode.
 */
export class DesignDocsRepository {
  private readonly changes: ChangesRepository;

  constructor(changes: ChangesRepository) {
    this.changes = changes;
  }

  async create(
    change: string,
    document: DesignDocument,
  ): Promise<StoredDesignDoc> {
    return this.files(change).write(document);
  }

  async findById(change: string, id: string): Promise<StoredDesignDoc | null> {
    return this.files(change).read(id);
  }

  /** Newest first — `date` drives ordering on the documents page (design-doc.ts). */
  async list(change: string): Promise<StoredDesignDoc[]> {
    const stored = await this.files(change).list();
    return stored.sort(
      (a, b) =>
        b.entity.date.localeCompare(a.entity.date) ||
        a.entity.name.localeCompare(b.entity.name),
    );
  }

  async delete(change: string, id: string): Promise<boolean> {
    return this.files(change).remove(id);
  }

  private files(change: string): FileRepository<DesignDocument> {
    return new FileRepository<DesignDocument>({
      dir: this.changes.dirOf(change, 'design-docs'),
      slugOf: (document) => document.name,
      decode: (raw) => DesignDocumentSchema.parse(raw),
    });
  }
}
