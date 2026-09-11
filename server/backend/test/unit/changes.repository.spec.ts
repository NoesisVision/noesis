import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isChangeSlug } from '../../src/changes/changes.repository.js';
import { type TestNoesis, testNoesis } from './test-noesis.js';

let t: TestNoesis;

beforeEach(async () => {
  t = await testNoesis();
});

afterEach(() => t.cleanup());

describe('ChangesRepository', () => {
  it('lists nothing before the first change, then the directories sorted', async () => {
    expect(await t.changesRepository.list()).toEqual([]);

    expect(await t.changesRepository.create('payment-retry')).toBe(true);
    expect(await t.changesRepository.create('audit-log')).toBe(true);

    expect(await t.changesRepository.list()).toEqual([
      'audit-log',
      'payment-retry',
    ]);
    expect(await t.changesRepository.exists('audit-log')).toBe(true);
    expect(await t.changesRepository.exists('missing')).toBe(false);
  });

  it('answers false for a change that already exists', async () => {
    await t.changesRepository.create('twice');
    expect(await t.changesRepository.create('twice')).toBe(false);
  });

  it('ignores files and dot entries under changes/', async () => {
    const changes = t.noesis.resolve('changes');
    await mkdir(join(changes, '.hidden'), { recursive: true });
    await writeFile(join(changes, 'README.md'), 'notes');
    await t.changesRepository.create('real');

    expect(await t.changesRepository.list()).toEqual(['real']);
  });

  it('builds paths under the change and refuses unsafe slugs', () => {
    expect(t.changesRepository.dirOf('real', 'design-docs')).toBe(
      t.noesis.resolve('changes', 'real', 'design-docs'),
    );
    expect(() => t.changesRepository.dirOf('../escape')).toThrow(
      'Not a change slug',
    );
    expect(isChangeSlug('ok-slug-1')).toBe(true);
    for (const bad of ['', 'Upper', 'a--b', '-lead', 'trail-', 'a/b', 'a b']) {
      expect(isChangeSlug(bad)).toBe(false);
    }
  });
});
