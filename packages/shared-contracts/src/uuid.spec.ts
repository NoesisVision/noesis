import { describe, expect, it } from 'bun:test';
import { contentHashAsUuid, newUuid } from './uuid.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('newUuid', () => {
  it('returns a uuid-shaped string', () => {
    expect(newUuid()).toMatch(UUID_RE);
  });
});

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
