import type { ChangeId } from '#backend/app/changes/change-id';
import {
  type DesignDocument,
  DesignDocumentSchema,
} from '#backend/app/design-docs/design-doc';
import type { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import type { DesignDocsRepository } from '#backend/app/design-docs/design-docs.repository';
import type {
  ChangeChildren,
  NoesisChangesRepository,
} from './changes.repository';

export class NoesisDesignDocsRepository implements DesignDocsRepository {
  private readonly changes: NoesisChangesRepository;

  constructor(changes: NoesisChangesRepository) {
    this.changes = changes;
  }

  get(change: ChangeId, id: DesignDocId): Promise<DesignDocument | null> {
    return this.docs(change).get(id);
  }

  set(
    change: ChangeId,
    id: DesignDocId,
    document: DesignDocument,
  ): Promise<void> {
    // The store takes the JSON side of the contract and decodes it itself.
    return this.docs(change).set(id, DesignDocumentSchema.encode(document));
  }

  values(change: ChangeId): AsyncIterable<DesignDocument> {
    return this.docs(change).values();
  }

  private docs(change: ChangeId): ChangeChildren['design-docs'] {
    return this.changes.children(change)['design-docs'];
  }
}
