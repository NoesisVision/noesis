import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import {
  DocumentId,
  DocumentIdSchema,
  InvalidDocumentIdError,
  TitleWithoutIdError,
} from '#backend/app/information-sources/model/document-id';

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
      expect(DocumentId.tryFromTitle(empty)).toBeNull();
      expect(() => DocumentId.fromTitle(empty)).toThrow(TitleWithoutIdError);
    }
    expect(DocumentId.tryFromTitle('Notes')?.value).toBe('notes');
  });

  it('parses a slug and nothing else', () => {
    expect(DocumentId.parse('ok-id-1').value).toBe('ok-id-1');
    for (const bad of ['', 'Upper', 'a--b', '-lead', 'trail-', 'a/b', '..']) {
      expect(DocumentId.tryParse(bad)).toBeNull();
      expect(() => DocumentId.parse(bad)).toThrow(InvalidDocumentIdError);
    }
    expect(DocumentId.tryParse('x'.repeat(128))).not.toBeNull();
    expect(DocumentId.tryParse('x'.repeat(129))).toBeNull();
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
