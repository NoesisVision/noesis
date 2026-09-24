import { join } from 'node:path';
import type { ChangeId } from '#backend/app/changes/change-id';
import {
  type DesignDocument,
  DesignDocumentSchema,
} from '#backend/app/design-docs/design-doc';
import type { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import type { DesignDocsRepository } from '#backend/app/design-docs/design-docs.repository';
import { JsonCollection } from '#backend/platform/files/json-collection';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { changesDir } from './changes.repository';

export class NoesisDesignDocsRepository implements DesignDocsRepository {
  private readonly changesDir: string;

  constructor(noesis: NoesisDir) {
    this.changesDir = changesDir(noesis);
  }

  get(change: ChangeId, id: DesignDocId): Promise<DesignDocument | null> {
    return this.docs(change).get(id);
  }

  list(change: ChangeId): Promise<DesignDocument[]> {
    return this.docs(change).list();
  }

  save(change: ChangeId, document: DesignDocument): Promise<void> {
    return this.docs(change).save(document);
  }

  private docs(change: ChangeId): JsonCollection<DesignDocument> {
    return new JsonCollection(
      DesignDocumentSchema,
      join(this.changesDir, change),
      'design-doc',
    );
  }
}
