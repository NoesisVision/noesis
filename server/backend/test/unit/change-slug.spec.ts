import { describe, expect, it } from 'bun:test';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import { ValueObjectError } from '#backend/app/vo';

describe('ChangeSlug', () => {
  it('parses a safe directory name and nothing else', () => {
    expect(ChangeSlug.create('ok-slug-1').value).toBe('ok-slug-1');
    for (const bad of ['', 'Upper', 'a--b', '-lead', 'trail-', 'a/b', 'a b']) {
      const result = ChangeSlug.tryCreate(bad);
      expect(result.isErr()).toBe(true);
      expect(result.isErr() && result.error[0]?.message).toContain(
        JSON.stringify(bad),
      );
      expect(() => ChangeSlug.create(bad)).toThrow(ValueObjectError);
    }
    expect(ChangeSlug.tryCreate('x'.repeat(64)).isOk()).toBe(true);
    expect(ChangeSlug.tryCreate('x'.repeat(65)).isErr()).toBe(true);
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
    const a = ChangeSlug.create('same');
    expect(a.equals(ChangeSlug.create('same'))).toBe(true);
    expect(a.equals(ChangeSlug.create('other'))).toBe(false);
    expect(`${a}`).toBe('same');
    expect(JSON.stringify({ slug: a })).toBe('{"slug":"same"}');
  });
});
