import type { ChangeId } from '#backend/app/changes/change-id';
import {
  type Document,
  DocumentSchema,
} from '#backend/app/information-sources/document';
import type { DocumentId } from '#backend/app/information-sources/document-id';
import type { DocumentsRepository } from '#backend/app/information-sources/documents.repository';
import type {
  ChangeChildren,
  NoesisChangesRepository,
} from './changes.repository';

export class NoesisDocumentsRepository implements DocumentsRepository {
  private readonly changes: NoesisChangesRepository;

  constructor(changes: NoesisChangesRepository) {
    this.changes = changes;
  }

  get(change: ChangeId, id: DocumentId): Promise<Document | null> {
    return this.documents(change).get(id);
  }

  set(change: ChangeId, id: DocumentId, document: Document): Promise<void> {
    // The store takes the JSON side of the contract and decodes it itself.
    return this.documents(change).set(id, DocumentSchema.encode(document));
  }

  values(change: ChangeId): AsyncIterable<Document> {
    return this.documents(change).values();
  }

  private documents(change: ChangeId): ChangeChildren['documents'] {
    return this.changes.children(change).documents;
  }
}
