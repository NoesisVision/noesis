import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Change } from '#backend/app/changes/change';
import { ChangeId } from '#backend/app/changes/change-id';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;

beforeEach(async () => {
  t = await testNoesis();
});

afterEach(() => t.cleanup());

const change = (id: string, overrides: Partial<Change> = {}): Change => ({
  id: ChangeId.parse(id),
  name: 'Payment retry',
  key: '',
  type: 'fix',
  status: 'discovery',
  description: '',
  ...overrides,
});

describe('ChangesService', () => {
  it('creates a change at a new id and updates it at an existing one', async () => {
    const first = await t.changesService.add(
      change('2026-01-01-payment-retry'),
    );
    const second = await t.changesService.add(
      change('2026-01-01-payment-retry', {
        name: 'Payment retries',
        status: 'design',
      }),
    );

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(await t.changesService.list()).toEqual([second.value]);
    expect(second.value.name).toBe('Payment retries');
  });

  it('answers created to only one of two parallel adds at one id', async () => {
    const results = await Promise.all([
      t.changesService.add(change('2026-01-01-payment-retry')),
      t.changesService.add(
        change('2026-01-01-payment-retry', { type: 'chore' }),
      ),
    ]);

    expect(results.map((r) => r.created)).toEqual([true, false]);
    const [stored] = await t.changesService.list();
    expect(stored?.type).toBe('chore');
  });

  it('lets a tracker key repeat across changes', async () => {
    await t.changesService.add(change('2026-01-01-one', { key: 'NOE-1' }));
    await t.changesService.add(change('2026-01-02-two', { key: 'NOE-1' }));

    expect(await t.changesService.list()).toHaveLength(2);
  });

  it('lists newest first, by id', async () => {
    for (const id of ['2026-01-02-b', '2026-03-01-a', '2026-01-02-c']) {
      await t.changesService.add(change(id));
    }

    expect((await t.changesService.list()).map((c) => c.id)).toEqual([
      ChangeId.parse('2026-03-01-a'),
      ChangeId.parse('2026-01-02-c'),
      ChangeId.parse('2026-01-02-b'),
    ]);
  });
});
