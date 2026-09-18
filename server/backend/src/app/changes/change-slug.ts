/**
 * The identity of a change: the name of its directory under
 * `.noesis/graph/changes/` and the key of its object in the store. A value
 * object — two slugs with the same text are the same slug — that exists only
 * in valid form: lower-case kebab-case, at most 64 characters, nothing that
 * could climb out of the collection. Strings become slugs at the edges of the
 * service (a route parameter, a tool argument, the name of a new change);
 * inside, a change is named by a `ChangeSlug`.
 *
 * The `change` contract carries the same text as its `slug` field, because
 * the contract is shared with the frontend as JSON; `toJSON` keeps a slug
 * serialising to that string.
 */
export class ChangeSlug {
  static readonly PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  static readonly MAX_LENGTH = 64;

  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /** The slug `value` spells; throws `InvalidChangeSlugError` otherwise. */
  static parse(value: string): ChangeSlug {
    const slug = ChangeSlug.tryParse(value);
    if (slug === null) throw new InvalidChangeSlugError(value);
    return slug;
  }

  /** The slug `value` spells, or `null` when it is not one. */
  static tryParse(value: string): ChangeSlug | null {
    return typeof value === 'string' &&
      value.length <= ChangeSlug.MAX_LENGTH &&
      ChangeSlug.PATTERN.test(value)
      ? new ChangeSlug(value)
      : null;
  }

  /** The slug a name gets: kebab-cased, capped, never empty. */
  static fromName(name: string): ChangeSlug {
    const slug = name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, ChangeSlug.MAX_LENGTH)
      .replace(/-+$/, '');
    return new ChangeSlug(slug || 'untitled');
  }

  equals(other: ChangeSlug): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}

/** A string that is not a change slug, where one was required. */
export class InvalidChangeSlugError extends Error {
  readonly value: string;

  constructor(value: string) {
    super(`Not a change slug: ${JSON.stringify(value)}`);
    this.name = 'InvalidChangeSlugError';
    this.value = value;
  }
}
