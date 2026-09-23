import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import {
  DocumentId,
  DocumentIdSchema,
} from '#backend/app/information-sources/document-id';
import { ValueObjectError } from '#backend/app/vo';

describe('DocumentId', () => {
  it('derives an id from a title', () => {
    expect(DocumentId.fromTitle('Payment retry (v2)').value).toBe(
      'payment-retry-v2',
    );
    expect(DocumentId.fromTitle('Été à Paris').value).toBe('ete-a-paris');
    expect(DocumentId.fromTitle('x'.repeat(200)).value).toHaveLength(128);
  });

  it('refuses a title the derivation empties', () => {
    for (const empty of ['!!!', '   ', '日本語']) {
      const result = DocumentId.tryFromTitle(empty);
      expect(result.isErr()).toBe(true);
      expect(result.isErr() && result.error[0]?.path).toEqual(['title']);
      expect(() => DocumentId.fromTitle(empty)).toThrow(ValueObjectError);
    }
    expect(DocumentId.tryFromTitle('Notes').unwrapOr(null)?.value).toBe(
      'notes',
    );
  });

  it('derives an id from every title its pattern admits', () => {
    const admitted = ['a', 'Z', '7', '!!!x', '日本語 2', `${'-'.repeat(300)}q`];
    for (const title of admitted) {
      expect(DocumentId.TITLE_PATTERN.test(title)).toBe(true);
      const id = DocumentId.tryFromTitle(title);
      expect(id.isOk()).toBe(true);
      expect(id.andThen((id) => DocumentId.tryCreate(id.value)).isOk()).toBe(
        true,
      );
    }
    for (const refused of ['', '!!!', '   ', '日本語', 'É']) {
      expect(DocumentId.TITLE_PATTERN.test(refused)).toBe(false);
    }
  });

  it('parses a slug and nothing else', () => {
    expect(DocumentId.create('ok-id-1').value).toBe('ok-id-1');
    for (const bad of ['', 'Upper', 'a--b', '-lead', 'trail-', 'a/b', '..']) {
      const result = DocumentId.tryCreate(bad);
      expect(result.isErr()).toBe(true);
      expect(result.isErr() && result.error[0]?.message).toContain(
        JSON.stringify(bad),
      );
      expect(() => DocumentId.create(bad)).toThrow(ValueObjectError);
    }
    expect(DocumentId.tryCreate('x'.repeat(128)).isOk()).toBe(true);
    expect(DocumentId.tryCreate('x'.repeat(129)).isErr()).toBe(true);
  });

  it('is a string in JSON and a value object in the contract', () => {
    const id = DocumentIdSchema.parse('notes');
    expect(id).toBeInstanceOf(DocumentId);
    expect(DocumentIdSchema.encode(id)).toBe('notes');
    expect(DocumentIdSchema.safeParse('../escape').success).toBe(false);
    expect(z.toJSONSchema(DocumentIdSchema, { io: 'input' })).toMatchObject({
      type: 'string',
      maxLength: 128,
    });
  });

  it('is a value: equal by text, and the text in a string or in JSON', () => {
    const a = DocumentId.fromTitle('Same');
    expect(a.equals(DocumentId.fromTitle('same'))).toBe(true);
    expect(a.equals(DocumentId.fromTitle('other'))).toBe(false);
    expect(`${a}`).toBe('same');
    expect(JSON.stringify({ id: a })).toBe('{"id":"same"}');
  });
});
