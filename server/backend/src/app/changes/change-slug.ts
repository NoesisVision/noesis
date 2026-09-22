import { ok, type Result } from 'neverthrow';
import { fail, unwrap, type VoIssue } from '#backend/app/vo';

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

  /** Trusted input only: tests, constants, already-validated data. */
  static create(value: string): ChangeSlug {
    return unwrap(ChangeSlug.name, ChangeSlug.tryCreate(value));
  }

  static tryCreate(value: string): Result<ChangeSlug, VoIssue[]> {
    return typeof value === 'string' &&
      value.length <= ChangeSlug.MAX_LENGTH &&
      ChangeSlug.PATTERN.test(value)
      ? ok(new ChangeSlug(value))
      : fail(
          `Not a change slug: ${JSON.stringify(value)}. Expected lower-case kebab-case of at most ${ChangeSlug.MAX_LENGTH} characters, e.g. 'payment-retry'.`,
        );
  }

  static fromName(name: string): ChangeSlug {
    const slug = name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
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
