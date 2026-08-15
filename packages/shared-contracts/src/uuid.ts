/// <reference types="bun" />
// The reference is not redundant: this module is reachable from the ui app's
// type graph (through `backend/client` → the auth repository), and that
// compilation does not carry Bun's ambient types.
import { createHash } from 'node:crypto';

export function newUuid(): string {
  return Bun.randomUUIDv7();
}

export function contentHashAsUuid(content: string | Buffer): string {
  const hex = createHash('sha256').update(content).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}
