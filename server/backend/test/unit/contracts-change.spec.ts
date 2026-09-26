import { describe, expect, it } from 'bun:test';
import {
  CHANGE_STATUSES,
  CHANGE_TYPES,
  ChangeSnapshot as Change,
} from '#backend/app/changes/change-snapshot';

describe('ChangeSnapshot', () => {
  const minimal = {
    id: '2026-09-13-payment-retry',
    name: 'Payment retry',
    type: 'feature' as const,
    version: 1,
    designDocs: [],
    sourceDocuments: [],
  };

  it('starts a new change in discovery, with no key and no description', () => {
    expect(Change.parse(minimal)).toEqual({
      ...minimal,
      id: Change.shape.id.parse(minimal.id),
      key: '',
      status: 'discovery',
      description: '',
    });
  });

  it('trims the name and requires a type', () => {
    expect(Change.parse({ ...minimal, name: '  Payment retry ' }).name).toBe(
      'Payment retry',
    );
    const { type: _, ...withoutType } = minimal;
    expect(Change.safeParse(withoutType).success).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(Change.safeParse({ ...minimal, name: '   ' }).success).toBe(false);
  });

  it('requires a dated id', () => {
    expect(Change.safeParse({ ...minimal, id: 'payment-retry' }).success).toBe(
      false,
    );
    const { id: _, ...withoutId } = minimal;
    expect(Change.safeParse(withoutId).success).toBe(false);
  });

  it('accepts a tracker key or nothing, never a malformed one', () => {
    expect(Change.parse({ ...minimal, key: 'NOE-142' }).key).toBe('NOE-142');
    expect(Change.parse({ ...minimal, key: '' }).key).toBe('');
    for (const bad of ['noe-142', 'NOE142', 'N-1', 'NOE-', 'TOOLONGKEY-1']) {
      expect(Change.safeParse({ ...minimal, key: bad }).success).toBe(false);
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

  it('requires a version of 1 or more', () => {
    const { version: _, ...unversioned } = minimal;
    expect(Change.safeParse(unversioned).success).toBe(false);
    expect(Change.safeParse({ ...minimal, version: 0 }).success).toBe(false);
  });

  it('rejects a type or status outside the vocabulary', () => {
    expect(Change.safeParse({ ...minimal, type: 'feat' }).success).toBe(false);
    expect(Change.safeParse({ ...minimal, status: 'shipped' }).success).toBe(
      false,
    );
  });
});
