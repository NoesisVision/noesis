import type { ChangeSlug } from '#backend/app/changes/change-slug';
import type { DocumentsRepository } from '#backend/app/information-sources/documents.repository';
import {
  type Document,
  DocumentSchema,
} from '#backend/app/information-sources/model/document';
import type { DocumentId } from '#backend/app/information-sources/model/document-id';
import type {
  ChangeChildren,
  NoesisChangesRepository,
} from './changes.repository';

export class NoesisDocumentsRepository implements DocumentsRepository {
  private readonly changes: NoesisChangesRepository;

  constructor(changes: NoesisChangesRepository) {
    this.changes = changes;
  }

  get(slug: ChangeSlug, id: DocumentId): Promise<Document | null> {
    return this.documents(slug).get(id.value);
  }

  set(slug: ChangeSlug, id: DocumentId, document: Document): Promise<void> {
    // The store takes the JSON side of the contract and decodes it itself.
    return this.documents(slug).set(id.value, DocumentSchema.encode(document));
  }

  delete(slug: ChangeSlug, id: DocumentId): Promise<boolean> {
    return this.documents(slug).delete(id.value);
  }

  values(slug: ChangeSlug): AsyncIterable<Document> {
    return this.documents(slug).values();
  }

  pathOf(slug: ChangeSlug, id: DocumentId): string {
    return this.documents(slug).dataFile(id.value);
  }

  private documents(slug: ChangeSlug): ChangeChildren['documents'] {
    return this.changes.children(slug).documents;
  }
}
