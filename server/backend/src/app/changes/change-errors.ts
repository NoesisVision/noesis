import type { ChangeSlug } from './change-slug';

/*
 * What a call on changes can foresee going wrong, as plain tagged values:
 * services return them in a `Result`, and each adapter answers every kind.
 */

/** The change a call names does not exist. */
export interface ChangeNotFound {
  readonly kind: 'change-not-found';
  readonly slug: ChangeSlug;
  readonly message: string;
}

export function changeNotFound(slug: ChangeSlug): ChangeNotFound {
  return {
    kind: 'change-not-found',
    slug,
    message: `No change ${JSON.stringify(slug.value)}.`,
  };
}

export type DuplicateChangeField = 'slug' | 'key';

/** Another change already has this slug, or this tracker key. */
export interface DuplicateChange {
  readonly kind: 'duplicate-change';
  readonly field: DuplicateChangeField;
  readonly value: string;
  readonly message: string;
}

export function duplicateChange(
  field: DuplicateChangeField,
  value: string,
): DuplicateChange {
  return {
    kind: 'duplicate-change',
    field,
    value,
    message:
      field === 'key'
        ? `A change with key ${JSON.stringify(value)} already exists.`
        : `Change ${JSON.stringify(value)} already exists.`,
  };
}
