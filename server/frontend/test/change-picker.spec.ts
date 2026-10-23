import { describe, expect, it } from 'bun:test';
import { changeAge } from '../src/features/changes/changes.model';

describe('how long ago a change was made', () => {
  const now = new Date(2026, 9, 23, 15, 0);
  it('reads its age from the date its id starts with', () => {
    expect(changeAge('2026-10-23-split-orders', now)).toBe('today');
    expect(changeAge('2026-10-21-vat-rounding', now)).toBe('2d');
    expect(changeAge('2026-10-14-loyalty-expiry', now)).toBe('1w');
    expect(changeAge('2026-07-01-old-one', now)).toBe('3mo');
    expect(changeAge('2024-10-01-older', now)).toBe('2y');
  });

  it('says nothing for an id without a date', () => {
    expect(changeAge('payment-retry', now)).toBe('');
  });
});
