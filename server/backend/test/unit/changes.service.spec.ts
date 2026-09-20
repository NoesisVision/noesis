import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { DuplicateChangeError } from '#backend/app/changes/changes.service';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;

beforeEach(async () => {
  t = await testNoesis();
});

afterEach(() => t.cleanup());

describe('ChangesService', () => {
  it('lets only one of two parallel creates with the same name through', async () => {
    const results = await Promise.allSettled([
      t.changesService.create({ name: 'Payment retry', key: '', type: 'fix' }),
      t.changesService.create({
        name: 'Payment retry',
        key: '',
        type: 'chore',
      }),
    ]);

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(
      DuplicateChangeError,
    );
    const [stored] = await t.changesService.list();
    expect(stored?.type).toBe('fix');
  });

  it('lets only one of two parallel creates with the same key through', async () => {
    const results = await Promise.allSettled([
      t.changesService.create({ name: 'One', key: 'NOE-1', type: 'fix' }),
      t.changesService.create({ name: 'Two', key: 'NOE-1', type: 'fix' }),
    ]);

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    expect(await t.changesService.list()).toHaveLength(1);
  });

  it('keeps serving creates after one failed', async () => {
    await t.changesService.create({ name: 'One', key: '', type: 'fix' });
    await t.changesService
      .create({ name: 'One', key: '', type: 'fix' })
      .catch(() => undefined);

    const next = await t.changesService.create({
      name: 'Two',
      key: '',
      type: 'fix',
    });

    expect(next.slug).toBe('two');
  });
});
