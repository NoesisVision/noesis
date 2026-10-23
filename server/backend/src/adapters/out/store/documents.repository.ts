import { join } from 'node:path';
import type { ChangeId } from '#backend/app/changes/change-id';
import {
  type Document,
  DocumentSchema,
} from '#backend/app/information-sources/document';
import type { DocumentId } from '#backend/app/information-sources/document-id';
import type { DocumentsRepository } from '#backend/app/information-sources/documents.repository';
import { byId, JsonCollection } from '#backend/platform/files/json-collection';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { changesDir } from './changes.repository';

/** `graph/changes/<change>/<id>.document.json`. */
export class DocumentsFileRepository implements DocumentsRepository {
  private readonly changesDir: string;

  constructor(noesis: NoesisDir) {
    this.changesDir = changesDir(noesis);
  }

  get(change: ChangeId, id: DocumentId): Promise<Document | null> {
    return this.in(change).get(id);
  }

  list(change: ChangeId): Promise<Document[]> {
    return this.in(change).list();
  }

  create(change: ChangeId, document: Document): Promise<boolean> {
    return this.in(change).create(document);
  }

  replace(change: ChangeId, document: Document): Promise<boolean> {
    return this.in(change).replace(document);
  }

  delete(change: ChangeId, id: DocumentId): Promise<boolean> {
    return this.in(change).delete(id);
  }

  private in(change: ChangeId): JsonCollection<Document> {
    return new JsonCollection(
      DocumentSchema,
      join(this.changesDir, change),
      byId('document'),
    );
  }
}
