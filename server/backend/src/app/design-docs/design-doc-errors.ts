import type { ChangeSlug } from '#backend/app/changes/change-slug';
import type { DesignDocId } from './design-doc-id';

/** The change exists, but has no design document with this id. */
export interface DesignDocNotFound {
  readonly kind: 'design-doc-not-found';
  readonly slug: ChangeSlug;
  readonly id: DesignDocId;
  readonly message: string;
}

export function designDocNotFound(
  slug: ChangeSlug,
  id: DesignDocId,
): DesignDocNotFound {
  return {
    kind: 'design-doc-not-found',
    slug,
    id,
    message: `No design document ${JSON.stringify(id.value)} in change ${slug.value}.`,
  };
}
