import { describe, expect, it } from 'bun:test';
import { contentHashAsUuid } from '../../src/platform/crypto/content-hash.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('contentHashAsUuid', () => {
  it('is deterministic and uuid-shaped for the same content', () => {
    const a = contentHashAsUuid('hello');
    const b = contentHashAsUuid('hello');
    expect(a).toBe(b);
    expect(a).toMatch(UUID_RE);
  });

  it('differs for different content', () => {
    expect(contentHashAsUuid('a')).not.toBe(contentHashAsUuid('b'));
  });
});
