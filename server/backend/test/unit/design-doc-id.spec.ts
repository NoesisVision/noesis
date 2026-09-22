import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import {
  DesignDocId,
  DesignDocIdSchema,
} from '#backend/app/design-docs/design-doc-id';

describe('DesignDocId', () => {
  it('mints distinct UUIDv7 ids it accepts back', () => {
    const [a, b] = [DesignDocId.mint(), DesignDocId.mint()];

    expect(a.equals(b)).toBe(false);
    expect(a.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
    expect(DesignDocId.tryCreate(a.value).isOk()).toBe(true);
  });

  it('refuses what could climb out of its directory or is no store key', () => {
    for (const value of ['../x', 'a/b', 'Upper', '', 'x'.repeat(129)]) {
      expect(DesignDocId.tryCreate(value).isErr()).toBe(true);
    }
  });

  it('travels as the plain string it is written as', () => {
    const id = DesignDocId.create('refund-partial-orders');

    expect(JSON.stringify({ id })).toBe('{"id":"refund-partial-orders"}');
    expect(z.encode(DesignDocIdSchema, id)).toBe('refund-partial-orders');
    expect(z.decode(DesignDocIdSchema, 'refund-partial-orders')).toEqual(id);
  });
});
