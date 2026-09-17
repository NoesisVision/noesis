import { createHash } from 'node:crypto';

// Ids the service mints (decision 68): time-ordered for what the graph
// authors itself, a content hash for imported sources so a re-import of the
// same content yields the same id and is detected as a duplicate.

export function newUuid(): string {
  return Bun.randomUUIDv7();
}

/** The SHA-256 of `content`, hex. */
export function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function contentHashAsUuid(content: string | Buffer): string {
  const hex = sha256(content);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}
