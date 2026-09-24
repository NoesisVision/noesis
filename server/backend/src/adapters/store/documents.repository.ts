import { join } from 'node:path';
import type { ChangeId } from '#backend/app/changes/change-id';
import {
  type Document,
  DocumentSchema,
} from '#backend/app/information-sources/document';
import type { DocumentId } from '#backend/app/information-sources/document-id';
import type { DocumentsRepository } from '#backend/app/information-sources/documents.repository';
import { JsonCollection } from '#backend/platform/files/json-collection';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { changesDir } from './changes.repository';

export class NoesisDocumentsRepository implements DocumentsRepository {
  private readonly changesDir: string;

  constructor(noesis: NoesisDir) {
    this.changesDir = changesDir(noesis);
  }

  get(change: ChangeId, id: DocumentId): Promise<Document | null> {
    return this.documents(change).get(id);
  }

  list(change: ChangeId): Promise<Document[]> {
    return this.documents(change).list();
  }

  save(change: ChangeId, document: Document): Promise<void> {
    return this.documents(change).save(document);
  }

  private documents(change: ChangeId): JsonCollection<Document> {
    return new JsonCollection(
      DocumentSchema,
      join(this.changesDir, change),
      'document',
    );
  }
}
