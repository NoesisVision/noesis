import { describe, expect, it } from 'bun:test';
import {
  CHANGE_STATUSES,
  CHANGE_TYPES,
  ChangeSchema,
  CreateChangeSchema,
} from '#backend/app/changes/model/change';

describe('ChangeSchema', () => {
  const minimal = {
    slug: 'payment-retry',
    name: 'Payment retry',
    key: 'NOE-142',
    type: 'feature' as const,
    status: 'discovery' as const,
    created_at: '2026-09-13T10:00:00+02:00',
  };

  it('defaults the description to empty', () => {
    expect(ChangeSchema.parse(minimal).description).toBe('');
  });

  it('keeps the vocabularies in the order the ui sorts by', () => {
    expect(CHANGE_TYPES).toEqual(['feature', 'fix', 'improvement', 'chore']);
    expect(CHANGE_STATUSES).toEqual([
      'discovery',
      'design',
      'implementation',
      'done',
    ]);
  });

  it('rejects a type or status outside the vocabulary', () => {
    expect(ChangeSchema.safeParse({ ...minimal, type: 'feat' }).success).toBe(
      false,
    );
    expect(
      ChangeSchema.safeParse({ ...minimal, status: 'shipped' }).success,
    ).toBe(false);
  });
});

describe('CreateChangeSchema', () => {
  it('trims the name, defaults the key to empty and requires a type', () => {
    expect(
      CreateChangeSchema.parse({ name: '  Payment retry ', type: 'fix' }),
    ).toEqual({ name: 'Payment retry', key: '', type: 'fix' });
    expect(CreateChangeSchema.safeParse({ name: 'No type' }).success).toBe(
      false,
    );
  });

  it('accepts a tracker key or nothing, never a malformed one', () => {
    const valid = { name: 'x', type: 'chore' };
    expect(CreateChangeSchema.parse({ ...valid, key: 'NOE-142' }).key).toBe(
      'NOE-142',
    );
    expect(CreateChangeSchema.parse({ ...valid, key: '' }).key).toBe('');
    for (const bad of ['noe-142', 'NOE142', 'N-1', 'NOE-', 'TOOLONGKEY-1']) {
      expect(CreateChangeSchema.safeParse({ ...valid, key: bad }).success).toBe(
        false,
      );
    }
  });

  it('rejects an empty name', () => {
    expect(
      CreateChangeSchema.safeParse({ name: '   ', type: 'fix' }).success,
    ).toBe(false);
  });
});
