import type { ChangeSlug } from '#backend/app/changes/change-slug';
import type { DesignDocsRepository } from '#backend/app/design-docs/design-docs.repository';
import type { DesignDocument } from '#backend/app/design-docs/model/design-doc';
import type {
  ChangeChildren,
  NoesisChangesRepository,
} from './changes.repository';

export class NoesisDesignDocsRepository implements DesignDocsRepository {
  private readonly changes: NoesisChangesRepository;

  constructor(changes: NoesisChangesRepository) {
    this.changes = changes;
  }

  get(slug: ChangeSlug, id: string): Promise<DesignDocument | null> {
    return this.docs(slug).get(id);
  }

  set(slug: ChangeSlug, id: string, document: DesignDocument): Promise<void> {
    return this.docs(slug).set(id, document);
  }

  delete(slug: ChangeSlug, id: string): Promise<boolean> {
    return this.docs(slug).delete(id);
  }

  values(slug: ChangeSlug): AsyncIterable<DesignDocument> {
    return this.docs(slug).values();
  }

  pathOf(slug: ChangeSlug, id: string): string {
    return this.docs(slug).dataFile(id);
  }

  private docs(slug: ChangeSlug): ChangeChildren['design-docs'] {
    return this.changes.children(slug)['design-docs'];
  }
}
