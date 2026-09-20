import type { ChangeSlug } from '#backend/app/changes/change-slug';
import type { DocumentsRepository } from '#backend/app/information-sources/documents.repository';
import type { Document } from '#backend/app/information-sources/model/document';
import type {
  ChangeChildren,
  NoesisChangesRepository,
} from './changes.repository';

export class NoesisDocumentsRepository implements DocumentsRepository {
  private readonly changes: NoesisChangesRepository;

  constructor(changes: NoesisChangesRepository) {
    this.changes = changes;
  }

  get(slug: ChangeSlug, id: string): Promise<Document | null> {
    return this.documents(slug).get(id);
  }

  set(slug: ChangeSlug, id: string, document: Document): Promise<void> {
    return this.documents(slug).set(id, document);
  }

  delete(slug: ChangeSlug, id: string): Promise<boolean> {
    return this.documents(slug).delete(id);
  }

  values(slug: ChangeSlug): AsyncIterable<Document> {
    return this.documents(slug).values();
  }

  pathOf(slug: ChangeSlug, id: string): string {
    return this.documents(slug).dataFile(id);
  }

  private documents(slug: ChangeSlug): ChangeChildren['documents'] {
    return this.changes.children(slug).documents;
  }
}
