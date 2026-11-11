import { join } from 'node:path';
import type { ChangeId } from '#backend/app/changes/change-id';
import { DesignDocument } from '#backend/app/design-docs/design-doc';
import type { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import type { DesignDocsRepository } from '#backend/app/design-docs/design-docs.repository';
import { byId, JsonCollection } from '#backend/platform/files/json-collection';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { changesDir } from './changes.repository';

/** `graph/changes/<change>/<id>.design-doc.json`. */
export class DesignDocsFileRepository implements DesignDocsRepository {
  private readonly changesDir: string;

  constructor(noesis: NoesisDir) {
    this.changesDir = changesDir(noesis);
  }

  get(change: ChangeId, id: DesignDocId): Promise<DesignDocument | null> {
    return this.in(change).get(id);
  }

  list(change: ChangeId): Promise<DesignDocument[]> {
    return this.in(change).list();
  }

  create(change: ChangeId, designDoc: DesignDocument): Promise<boolean> {
    return this.in(change).create(designDoc);
  }

  replace(change: ChangeId, designDoc: DesignDocument): Promise<boolean> {
    return this.in(change).replace(designDoc);
  }

  private in(change: ChangeId): JsonCollection<DesignDocument> {
    return new JsonCollection(
      DesignDocument,
      join(this.changesDir, change),
      byId('design-doc'),
    );
  }
}
