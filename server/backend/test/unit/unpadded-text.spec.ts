import { describe, expect, it } from 'bun:test';
import fc from 'fast-check';
import { unpaddedText } from '#backend/app/unpadded-text';

const schema = unpaddedText();

describe('unpaddedText', () => {
  // The pattern stands in for a `.trim()` JSON Schema could not carry, so it
  // must agree with `trim()` on every string: refused exactly when trimming
  // would change it, or leave nothing.
  it('accepts exactly the text trim() would leave alone, for any text', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme' }), (text) => {
        const trimmed = text.trim();
        expect(schema.safeParse(text).success).toBe(
          trimmed === text && trimmed !== '',
        );
      }),
    );
  });

  it('accepts inner whitespace, line breaks included', () => {
    for (const text of ['a b', 'a\nb', 'a\n\n b \t c']) {
      expect(schema.safeParse(text).success).toBe(true);
    }
  });

  it.each(['', ' ', ' a', 'a ', '\na', 'a\t', '\u00a0a'])(
    'refuses %j',
    (text) => {
      expect(schema.safeParse(text).success).toBe(false);
    },
  );
});
