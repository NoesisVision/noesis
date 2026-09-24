import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { entityId, isoDate } from '../scripts/entity-id';

const DAY = new Date(2026, 8, 24);

test('prefixes the slug of the title with the local date', () => {
  expect(entityId('Payment retry (v2)', DAY)).toBe(
    '2026-09-24-payment-retry-v2',
  );
  expect(entityId('Payment retry', new Date(2024, 1, 29, 23, 59))).toBe(
    '2024-02-29-payment-retry',
  );
});

test('folds accents and letters NFKD leaves whole', () => {
  expect(entityId('Été à Paris', DAY)).toBe('2026-09-24-ete-a-paris');
  expect(entityId('Zażółć gęślą jaźń', DAY)).toBe(
    '2026-09-24-zazolc-gesla-jazn',
  );
  expect(entityId('Łódź Straße', DAY)).toBe('2026-09-24-lodz-strasse');
});

test('falls back to untitled when nothing is left to slug', () => {
  for (const empty of ['!!!', '   ', '日本語']) {
    expect(entityId(empty, DAY)).toBe('2026-09-24-untitled');
  }
});

test('cuts the slug so the whole id fits 64 characters', () => {
  expect(entityId('x'.repeat(80), DAY)).toHaveLength(64);
  // A cut that lands on a separator leaves no trailing hyphen.
  const id = entityId(`${'a'.repeat(52)} bcd`, DAY);
  expect(id).toBe(`2026-09-24-${'a'.repeat(52)}`);
});

test('mints an id the service accepts', () => {
  const pattern = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
  for (const title of ['A', '-- x --', 'Łódź', '!!!', 'x'.repeat(200)]) {
    expect(entityId(title, DAY)).toMatch(pattern);
  }
});

test('the CLI prints the id minted today', () => {
  const script = fileURLToPath(
    new URL('../scripts/entity-id.ts', import.meta.url),
  );
  const run = spawnSync('bun', [script, 'Payment retry'], { encoding: 'utf8' });
  expect(run.status).toBe(0);
  expect(run.stdout.trim()).toBe(`${isoDate(new Date())}-payment-retry`);
});
