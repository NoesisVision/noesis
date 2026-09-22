import { ok, type Result } from 'neverthrow';
import { z } from 'zod';
import { fail, unwrap, voCodec, type VoIssue } from '#backend/app/vo';

/**
 * The title is the document's identity within its change, so the id is that
 * title as a slug and a retitle is a move. Exists only in valid form, so an id
 * can never climb out of its change's `documents/`. `toJSON` keeps it
 * serialising to the plain string it is on disk and on the wire.
 */
export class DocumentId {
  static readonly PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  /** As long as a store key may be (`KEY_PATTERN`). */
  static readonly MAX_LENGTH = 128;
  /**
   * What a title must match for an id to be derivable from it: one ASCII
   * letter or digit is what the derivation is sure to keep. Narrower than the
   * derivation itself — `É` alone would slug to `e` — so that the rule is one
   * a schema can state.
   */
  static readonly TITLE_PATTERN = /[A-Za-z0-9]/;
  /**
   * The id's own limit, so the derivation does not cut a title short and two
   * long titles cannot meet in one id. The cut in `tryFromTitle` stays for the
   * few characters NFKD expands (`ﬁ` becomes `fi`).
   */
  static readonly TITLE_MAX_LENGTH = DocumentId.MAX_LENGTH;

  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /** Trusted input only: tests, constants, already-validated data. */
  static create(value: string): DocumentId {
    return unwrap(DocumentId.name, DocumentId.tryCreate(value));
  }

  static tryCreate(value: string): Result<DocumentId, VoIssue[]> {
    return typeof value === 'string' &&
      value.length <= DocumentId.MAX_LENGTH &&
      DocumentId.PATTERN.test(value)
      ? ok(new DocumentId(value))
      : fail(
          `Not a document id: ${JSON.stringify(value)}. Expected lower-case kebab-case of at most ${DocumentId.MAX_LENGTH} characters, e.g. 'payment-retry'.`,
        );
  }

  /** The throwing twin of `tryFromTitle`, for a title already known to match `TITLE_PATTERN`. */
  static fromTitle(title: string): DocumentId {
    return unwrap(DocumentId.name, DocumentId.tryFromTitle(title));
  }

  /**
   * An issue for a title the derivation empties — punctuation or a script
   * with no ASCII in it. There is no fallback id: every such title would share
   * it, and the second one would look like a duplicate of the first. Never an
   * issue for a title matching `TITLE_PATTERN`.
   */
  static tryFromTitle(title: string): Result<DocumentId, VoIssue[]> {
    const slug = title
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, DocumentId.MAX_LENGTH)
      .replace(/-+$/, '');
    return slug === ''
      ? fail(
          `No document id can be derived from the title ${JSON.stringify(title)}: it needs a letter or a digit.`,
          ['title'],
        )
      : ok(new DocumentId(slug));
  }

  equals(other: DocumentId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}

/**
 * A codec, so the contract holds the value object while JSON on either side of
 * it stays a string: parsing decodes the string into a `DocumentId`, encoding
 * turns it back. The string side carries the whole rule, so decoding cannot
 * fail and the advertised JSON Schema states the pattern.
 */
export const DocumentIdSchema = voCodec(
  z.string().max(DocumentId.MAX_LENGTH).regex(DocumentId.PATTERN),
  DocumentId,
  (value) => DocumentId.tryCreate(value),
  (id) => id.value,
);
