import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;

beforeEach(async () => {
  t = await testNoesis();
});

afterEach(() => t.cleanup());

describe('ChangesService', () => {
  it('lets only one of two parallel creates with the same name through', async () => {
    const results = await Promise.all([
      t.changesService.create({ name: 'Payment retry', key: '', type: 'fix' }),
      t.changesService.create({
        name: 'Payment retry',
        key: '',
        type: 'chore',
      }),
    ]);

    expect(results.map((r) => r.isOk())).toEqual([true, false]);
    expect(results[1]?._unsafeUnwrapErr()).toMatchObject({
      kind: 'duplicate-change',
      field: 'slug',
    });
    const [stored] = await t.changesService.list();
    expect(stored?.type).toBe('fix');
  });

  it('lets only one of two parallel creates with the same key through', async () => {
    const results = await Promise.all([
      t.changesService.create({ name: 'One', key: 'NOE-1', type: 'fix' }),
      t.changesService.create({ name: 'Two', key: 'NOE-1', type: 'fix' }),
    ]);

    expect(results.map((r) => r.isOk())).toEqual([true, false]);
    expect(results[1]?._unsafeUnwrapErr()).toMatchObject({
      kind: 'duplicate-change',
      field: 'key',
    });
    expect(await t.changesService.list()).toHaveLength(1);
  });

  it('keeps serving creates after one was refused', async () => {
    await t.changesService.create({ name: 'One', key: '', type: 'fix' });
    const refused = await t.changesService.create({
      name: 'One',
      key: '',
      type: 'fix',
    });

    const next = await t.changesService.create({
      name: 'Two',
      key: '',
      type: 'fix',
    });

    expect(refused.isErr()).toBe(true);
    expect(next._unsafeUnwrap().slug).toBe('two');
  });

  it('answers a missing change as ChangeNotFound', async () => {
    const found = await t.changesService.findById(await t.createChange('here'));
    expect(found._unsafeUnwrap().slug).toBe('here');

    const missing = await t.changesService.findById(ChangeSlug.create('nope'));
    expect(missing._unsafeUnwrapErr().kind).toBe('change-not-found');
  });
});
