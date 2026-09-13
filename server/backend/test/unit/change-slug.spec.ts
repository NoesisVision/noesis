import { describe, expect, it } from 'bun:test';
import {
  ChangeSlug,
  InvalidChangeSlugError,
} from '../../src/changes/change-slug.js';

describe('ChangeSlug', () => {
  it('parses a safe directory name and nothing else', () => {
    expect(ChangeSlug.parse('ok-slug-1').value).toBe('ok-slug-1');
    for (const bad of ['', 'Upper', 'a--b', '-lead', 'trail-', 'a/b', 'a b']) {
      expect(ChangeSlug.tryParse(bad)).toBeNull();
      expect(() => ChangeSlug.parse(bad)).toThrow(InvalidChangeSlugError);
    }
    expect(ChangeSlug.tryParse('x'.repeat(64))).not.toBeNull();
    expect(ChangeSlug.tryParse('x'.repeat(65))).toBeNull();
  });

  it('derives a slug from a name', () => {
    expect(ChangeSlug.fromName('Payment retry (v2)').value).toBe(
      'payment-retry-v2',
    );
    expect(ChangeSlug.fromName('Été à Paris').value).toBe('ete-a-paris');
    expect(ChangeSlug.fromName('!!!').value).toBe('untitled');
    expect(ChangeSlug.fromName('x'.repeat(80)).value).toHaveLength(64);
  });

  it('is a value: equal by text, and the text in a string or in JSON', () => {
    const a = ChangeSlug.parse('same');
    expect(a.equals(ChangeSlug.parse('same'))).toBe(true);
    expect(a.equals(ChangeSlug.parse('other'))).toBe(false);
    expect(`${a}`).toBe('same');
    expect(JSON.stringify({ slug: a })).toBe('{"slug":"same"}');
  });
});
