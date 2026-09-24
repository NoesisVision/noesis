import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { ChangeId } from '#backend/app/changes/change-id';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import { DocumentId } from '#backend/app/information-sources/document-id';

describe.each([
  ['ChangeId', ChangeId],
  ['DesignDocId', DesignDocId],
  ['DocumentId', DocumentId],
] as const)('%s', (_name, Id) => {
  it('parses a creation date, then a slug', () => {
    for (const good of [
      '2026-09-24-payment-retry',
      '2024-02-29-x',
      '2026-12-31-v2',
      `2026-01-01-${'x'.repeat(53)}`,
    ]) {
      expect(Id.safeParse(good).success).toBe(true);
    }
  });

  it.each([
    ['a date that is not a day', '2026-02-29-x'],
    ['the 30th of February', '2026-02-30-x'],
    ['a thirteenth month', '2026-13-01-x'],
    ['a bare slug', 'payment-retry'],
    ['a bare date', '2026-09-24'],
    ['upper case', '2026-09-24-Payment'],
    ['a doubled hyphen', '2026-09-24-a--b'],
    ['a trailing hyphen', '2026-09-24-a-'],
    ['a path separator', '2026-09-24-a/b'],
    ['65 characters', `2026-01-01-${'x'.repeat(54)}`],
  ])('refuses %s', (_case, bad) => {
    expect(Id.safeParse(bad).success).toBe(false);
    expect(() => Id.parse(bad)).toThrow(z.ZodError);
  });

  it('is the same string in JSON and in the contract', () => {
    const id = Id.parse('2026-09-24-notes');
    expect(z.encode(Id, id)).toBe('2026-09-24-notes');
    expect(JSON.stringify({ id })).toBe('{"id":"2026-09-24-notes"}');
  });

  it('advertises its whole rule as the JSON Schema pattern', () => {
    const schema = z.toJSONSchema(Id, { io: 'input' });
    expect(schema).toMatchObject({ type: 'string', maxLength: 64 });
    const pattern = new RegExp(String(schema.pattern));
    expect(pattern.test('2024-02-29-x')).toBe(true);
    expect(pattern.test('2026-02-29-x')).toBe(false);
    for (const id of ['2026-09-24-payment-retry', '2024-02-29-x']) {
      expect(pattern.test(id)).toBe(Id.safeParse(id).success);
    }
  });
});
