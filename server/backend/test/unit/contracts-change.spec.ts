import { describe, expect, it } from 'bun:test';
import {
  CHANGE_STATUSES,
  CHANGE_TYPES,
  ChangeSchema,
} from '#backend/app/changes/change';

describe('ChangeSchema', () => {
  const minimal = {
    id: '2026-09-13-payment-retry',
    name: 'Payment retry',
    type: 'feature' as const,
  };

  it('starts a new change in discovery, with no key and no description', () => {
    expect(ChangeSchema.parse(minimal)).toEqual({
      ...minimal,
      id: ChangeSchema.shape.id.parse(minimal.id),
      key: '',
      status: 'discovery',
      description: '',
    });
  });

  it('trims the name and requires a type', () => {
    expect(
      ChangeSchema.parse({ ...minimal, name: '  Payment retry ' }).name,
    ).toBe('Payment retry');
    expect(
      ChangeSchema.safeParse({ id: minimal.id, name: 'No type' }).success,
    ).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(ChangeSchema.safeParse({ ...minimal, name: '   ' }).success).toBe(
      false,
    );
  });

  it('requires a dated id', () => {
    expect(
      ChangeSchema.safeParse({ ...minimal, id: 'payment-retry' }).success,
    ).toBe(false);
    const { id: _, ...withoutId } = minimal;
    expect(ChangeSchema.safeParse(withoutId).success).toBe(false);
  });

  it('accepts a tracker key or nothing, never a malformed one', () => {
    expect(ChangeSchema.parse({ ...minimal, key: 'NOE-142' }).key).toBe(
      'NOE-142',
    );
    expect(ChangeSchema.parse({ ...minimal, key: '' }).key).toBe('');
    for (const bad of ['noe-142', 'NOE142', 'N-1', 'NOE-', 'TOOLONGKEY-1']) {
      expect(ChangeSchema.safeParse({ ...minimal, key: bad }).success).toBe(
        false,
      );
    }
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
