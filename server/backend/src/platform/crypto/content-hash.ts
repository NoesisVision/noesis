import { createHash } from 'node:crypto';

// Content-hash ids for imported sources (decision D2): a re-import of the same
// content yields the same id and is detected as a duplicate.

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
