import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { SystemModelId } from '#backend/app/system-model/system-model-id';

/*
 * A system model's id is a lower-case UUIDv7 the server mints per scan. Its
 * leading digits are the time it was minted, so ids sort by scan time and the
 * newest model is found from file names alone.
 */

describe('SystemModelId', () => {
  it('accepts a lower-case UUIDv7', () => {
    expect(
      SystemModelId.safeParse('01a0d22d-7f47-76b9-abd4-bd21d66a1d17').success,
    ).toBe(true);
  });

  it.each([
    ['a UUIDv4', '550e8400-e29b-41d4-a716-446655440000'],
    ['upper case', '01A0D22D-7F47-76B9-ABD4-BD21D66A1D17'],
    ['a foreign variant', '01a0d22d-7f47-76b9-cbd4-bd21d66a1d17'],
    ['a name', 'shop'],
    ['nothing', ''],
  ])('rejects %s', (_, value) => {
    expect(SystemModelId.safeParse(value).success).toBe(false);
  });

  it('mints ids that sort in the order they were minted', () => {
    const minted = Array.from({ length: 100 }, () => SystemModelId.mint());

    expect(minted.toSorted()).toEqual(minted);
    expect(new Set(minted).size).toBe(minted.length);
  });

  it('advertises its pattern in JSON Schema', () => {
    expect(z.toJSONSchema(SystemModelId, { io: 'input' })).toMatchObject({
      type: 'string',
      pattern: expect.stringContaining('-7[0-9a-f]{3}-'),
    });
  });
});
