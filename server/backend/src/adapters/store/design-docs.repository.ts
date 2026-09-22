import type { ChangeSlug } from '#backend/app/changes/change-slug';
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

  get(slug: ChangeSlug, id: DesignDocId): Promise<DesignDocument | null> {
    return this.docs(slug).get(id.value);
  }

  set(
    slug: ChangeSlug,
    id: DesignDocId,
    document: DesignDocument,
  ): Promise<void> {
    // The store takes the JSON side of the contract and decodes it itself.
    return this.docs(slug).set(id.value, DesignDocumentSchema.encode(document));
  }

  delete(slug: ChangeSlug, id: DesignDocId): Promise<boolean> {
    return this.docs(slug).delete(id.value);
  }

  values(slug: ChangeSlug): AsyncIterable<DesignDocument> {
    return this.docs(slug).values();
  }

  pathOf(slug: ChangeSlug, id: DesignDocId): string {
    return this.docs(slug).dataFile(id.value);
  }

  private docs(slug: ChangeSlug): ChangeChildren['design-docs'] {
    return this.changes.children(slug)['design-docs'];
  }
}
