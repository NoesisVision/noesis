import { z } from 'zod';

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
  static readonly FALLBACK = 'untitled';

  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static parse(value: string): DocumentId {
    const id = DocumentId.tryParse(value);
    if (id === null) throw new InvalidDocumentIdError(value);
    return id;
  }

  static tryParse(value: string): DocumentId | null {
    return typeof value === 'string' &&
      value.length <= DocumentId.MAX_LENGTH &&
      DocumentId.PATTERN.test(value)
      ? new DocumentId(value)
      : null;
  }

  static fromTitle(title: string): DocumentId {
    return (
      DocumentId.tryFromTitle(title) ?? new DocumentId(DocumentId.FALLBACK)
    );
  }

  /**
   * Null for a title the derivation empties — punctuation or a script with no
   * ASCII in it. Every such title would share the one fallback id, so the
   * contract refuses them instead of letting the second one look like a
   * duplicate of the first.
   */
  static tryFromTitle(title: string): DocumentId | null {
    const slug = title
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, DocumentId.MAX_LENGTH)
      .replace(/-+$/, '');
    return slug === '' ? null : new DocumentId(slug);
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

export class InvalidDocumentIdError extends Error {
  readonly value: string;

  constructor(value: string) {
    super(`Not a document id: ${JSON.stringify(value)}`);
    this.name = 'InvalidDocumentIdError';
    this.value = value;
  }
}

/**
 * A codec, so the contract holds the value object while JSON on either side of
 * it stays a string: parsing decodes the string into a `DocumentId`, encoding
 * turns it back. The string side carries the whole rule, so decoding cannot
 * fail and the advertised JSON Schema states the pattern.
 */
export const DocumentIdSchema = z.codec(
  z.string().max(DocumentId.MAX_LENGTH).regex(DocumentId.PATTERN),
  z.custom<DocumentId>((value) => value instanceof DocumentId),
  {
    decode: (value) => DocumentId.parse(value),
    encode: (id) => id.value,
  },
);
