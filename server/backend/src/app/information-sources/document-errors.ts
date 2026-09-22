import type { ChangeSlug } from '#backend/app/changes/change-slug';
import type { DocumentId } from './document-id';

/** The change exists, but has no document with this id. */
export interface DocumentNotFound {
  readonly kind: 'document-not-found';
  readonly slug: ChangeSlug;
  readonly id: DocumentId;
  readonly message: string;
}

export function documentNotFound(
  slug: ChangeSlug,
  id: DocumentId,
): DocumentNotFound {
  return {
    kind: 'document-not-found',
    slug,
    id,
    message: `No document ${JSON.stringify(id.value)} in change ${slug.value}.`,
  };
}

/** The change already has a document with this title, so with this id. */
export interface DuplicateDocument {
  readonly kind: 'duplicate-document';
  readonly slug: ChangeSlug;
  readonly title: string;
  readonly message: string;
}

export function duplicateDocument(
  slug: ChangeSlug,
  title: string,
): DuplicateDocument {
  return {
    kind: 'duplicate-document',
    slug,
    title,
    message: `Change ${slug.value} already has a document titled ${JSON.stringify(title)}.`,
  };
}
