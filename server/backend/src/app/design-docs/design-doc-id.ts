import { ok, type Result } from 'neverthrow';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { fail, unwrap, voCodec, type VoIssue } from '#backend/app/vo';

/**
 * Minted by the server, never chosen by the caller. Exists only in valid
 * form, so an id can never climb out of its change's `design-docs/`. `toJSON`
 * keeps it serialising to the plain string it is on disk and on the wire.
 */
export class DesignDocId {
  /** What a store key may be (`KEY_PATTERN`); a minted UUID is one. */
  static readonly PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  static readonly MAX_LENGTH = 128;

  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /** Trusted input only: tests, constants, already-validated data. */
  static create(value: string): DesignDocId {
    return unwrap(DesignDocId.name, DesignDocId.tryCreate(value));
  }

  static tryCreate(value: string): Result<DesignDocId, VoIssue[]> {
    return typeof value === 'string' &&
      value.length <= DesignDocId.MAX_LENGTH &&
      DesignDocId.PATTERN.test(value)
      ? ok(new DesignDocId(value))
      : fail(
          `Not a design document id: ${JSON.stringify(value)}. Expected lower-case kebab-case of at most ${DesignDocId.MAX_LENGTH} characters, as the server minted it.`,
        );
  }

  /** A UUIDv7, so ids sort by when they were minted. */
  static mint(): DesignDocId {
    return new DesignDocId(uuidv7());
  }

  equals(other: DesignDocId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}

export const DesignDocIdSchema = voCodec(
  z.string().max(DesignDocId.MAX_LENGTH).regex(DesignDocId.PATTERN),
  DesignDocId,
  (value) => DesignDocId.tryCreate(value),
  (id) => id.value,
);
