import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { ChangeSlug } from '#backend/app/changes/change-slug';

describe('ChangeSlug', () => {
  it('parses a safe directory name and nothing else', () => {
    expect(ChangeSlug.parse('ok-slug-1')).toBe(ChangeSlug.parse('ok-slug-1'));
    for (const bad of ['', 'Upper', 'a--b', '-lead', 'trail-', 'a/b', 'a b']) {
      expect(ChangeSlug.safeParse(bad).success).toBe(false);
      expect(() => ChangeSlug.parse(bad)).toThrow(z.ZodError);
    }
    expect(ChangeSlug.safeParse('x'.repeat(64)).success).toBe(true);
    expect(ChangeSlug.safeParse('x'.repeat(65)).success).toBe(false);
  });

  it('derives a slug from a name', () => {
    expect(ChangeSlug.fromName('Payment retry (v2)')).toBe(
      ChangeSlug.parse('payment-retry-v2'),
    );
    expect(ChangeSlug.fromName('Été à Paris')).toBe(
      ChangeSlug.parse('ete-a-paris'),
    );
    expect(ChangeSlug.fromName('Zażółć gęślą jaźń')).toBe(
      ChangeSlug.parse('zazolc-gesla-jazn'),
    );
    expect(ChangeSlug.fromName('Łódź Straße')).toBe(
      ChangeSlug.parse('lodz-strasse'),
    );
    expect(ChangeSlug.fromName('!!!')).toBe(ChangeSlug.parse('untitled'));
    expect(ChangeSlug.fromName('x'.repeat(80))).toHaveLength(64);
  });

  it('advertises its rules in the JSON Schema', () => {
    expect(z.toJSONSchema(ChangeSlug, { io: 'input' })).toMatchObject({
      type: 'string',
      maxLength: 64,
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    });
  });
});
