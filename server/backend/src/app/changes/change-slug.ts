/**
 * Exists only in valid form, so a slug can never climb out of
 * `.noesis/graph/changes/`. `toJSON` keeps it serialising to the plain string
 * the `change` contract shares with the frontend.
 */
export class ChangeSlug {
  static readonly PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  static readonly MAX_LENGTH = 64;

  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static parse(value: string): ChangeSlug {
    const slug = ChangeSlug.tryParse(value);
    if (slug === null) throw new InvalidChangeSlugError(value);
    return slug;
  }

  static tryParse(value: string): ChangeSlug | null {
    return typeof value === 'string' &&
      value.length <= ChangeSlug.MAX_LENGTH &&
      ChangeSlug.PATTERN.test(value)
      ? new ChangeSlug(value)
      : null;
  }

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

export class InvalidChangeSlugError extends Error {
  readonly value: string;

  constructor(value: string) {
    super(`Not a change slug: ${JSON.stringify(value)}`);
    this.name = 'InvalidChangeSlugError';
    this.value = value;
  }
}
