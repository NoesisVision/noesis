import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { DocumentId } from '#backend/app/information-sources/document-id';

describe('DocumentId', () => {
  it('derives an id from a title', () => {
    expect(DocumentId.fromTitle('Payment retry (v2)')).toBe(
      DocumentId.parse('payment-retry-v2'),
    );
    expect(DocumentId.fromTitle('Été à Paris')).toBe(
      DocumentId.parse('ete-a-paris'),
    );
    expect(DocumentId.fromTitle('x'.repeat(200))).toHaveLength(128);
  });

  it('refuses a title the derivation empties', () => {
    for (const empty of ['!!!', '   ', '日本語']) {
      expect(() => DocumentId.fromTitle(empty)).toThrow(z.ZodError);
    }
    expect(DocumentId.fromTitle('Notes')).toBe(DocumentId.parse('notes'));
  });

  it('derives an id from every title its pattern admits', () => {
    const admitted = ['a', 'Z', '7', '!!!x', '日本語 2', `${'-'.repeat(300)}q`];
    for (const title of admitted) {
      expect(DocumentId.TITLE_PATTERN.test(title)).toBe(true);
      expect(() => DocumentId.fromTitle(title)).not.toThrow();
    }
    for (const refused of ['', '!!!', '   ', '日本語', 'É']) {
      expect(DocumentId.TITLE_PATTERN.test(refused)).toBe(false);
    }
  });

  it('parses a slug and nothing else', () => {
    expect(DocumentId.parse('ok-id-1')).toBe(DocumentId.parse('ok-id-1'));
    for (const bad of ['', 'Upper', 'a--b', '-lead', 'trail-', 'a/b', '..']) {
      expect(DocumentId.safeParse(bad).success).toBe(false);
      expect(() => DocumentId.parse(bad)).toThrow(z.ZodError);
    }
    expect(DocumentId.safeParse('x'.repeat(128)).success).toBe(true);
    expect(DocumentId.safeParse('x'.repeat(129)).success).toBe(false);
  });

  it('is the same string in JSON and in the contract', () => {
    const id = DocumentId.parse('notes');
    expect(z.encode(DocumentId, id)).toBe('notes');
    expect(JSON.stringify({ id })).toBe('{"id":"notes"}');
    expect(z.toJSONSchema(DocumentId, { io: 'input' })).toMatchObject({
      type: 'string',
      maxLength: 128,
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    });
  });
});
