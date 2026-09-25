import { describe, expect, it } from 'bun:test';
import { ChangeId } from '#backend/app/changes/change-id';
import { slugIdCandidates } from '#backend/app/slug-id';

const DAY = '2026-09-24';

function first(title: string, date = DAY): string {
  return slugIdCandidates(title, date).next().value;
}

function firstN(title: string, n: number): string[] {
  const candidates = slugIdCandidates(title, DAY);
  return Array.from({ length: n }, () => candidates.next().value);
}

describe('slugIdCandidates', () => {
  it('prefixes the slug of the title with the date', () => {
    expect(first('Payment retry (v2)')).toBe('2026-09-24-payment-retry-v2');
    expect(first('Payment retry', '2024-02-29')).toBe(
      '2024-02-29-payment-retry',
    );
  });

  it('folds accents and letters NFKD leaves whole', () => {
    expect(first('Été à Paris')).toBe('2026-09-24-ete-a-paris');
    expect(first('Zażółć gęślą jaźń')).toBe('2026-09-24-zazolc-gesla-jazn');
    expect(first('Łódź Straße')).toBe('2026-09-24-lodz-strasse');
  });

  it('falls back to untitled when nothing is left to slug', () => {
    for (const empty of ['!!!', '   ', '日本語']) {
      expect(first(empty)).toBe('2026-09-24-untitled');
    }
  });

  it('numbers the ids after the first from 2', () => {
    expect(firstN('Payment retry', 3)).toEqual([
      '2026-09-24-payment-retry',
      '2026-09-24-payment-retry-2',
      '2026-09-24-payment-retry-3',
    ]);
    expect(firstN('!!!', 2)[1]).toBe('2026-09-24-untitled-2');
  });

  it('cuts the slug so the whole id, suffix included, fits 64 characters', () => {
    expect(first('x'.repeat(80))).toHaveLength(64);
    // A cut that lands on a separator leaves no trailing hyphen.
    expect(first(`${'a'.repeat(52)} bcd`)).toBe(`2026-09-24-${'a'.repeat(52)}`);
    const [, second] = firstN('x'.repeat(80), 2);
    expect(second).toBe(`2026-09-24-${'x'.repeat(51)}-2`);
    expect(second).toHaveLength(64);
  });

  it('yields only ids the id schemas accept', () => {
    for (const title of ['A', '-- x --', 'Łódź', '!!!', 'x'.repeat(200)]) {
      for (const id of firstN(title, 12)) {
        expect(ChangeId.safeParse(id).success).toBe(true);
      }
    }
  });
});
