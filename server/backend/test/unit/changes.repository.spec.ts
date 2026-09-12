import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  isChangeSlug,
  slugForChange,
} from '../../src/changes/changes.repository.js';
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

  it('derives a slug from a name', () => {
    expect(slugForChange('Payment retry (v2)')).toBe('payment-retry-v2');
    expect(slugForChange('Été à Paris')).toBe('ete-a-paris');
    expect(slugForChange('!!!')).toBe('untitled');
    expect(slugForChange('x'.repeat(80))).toHaveLength(64);
  });

  it('round-trips change.json and reads a bare directory as a chore', async () => {
    await t.changesRepository.create('with-file');
    const change = {
      slug: 'with-file',
      name: 'With file',
      key: 'NOE-1',
      type: 'feature' as const,
      status: 'design' as const,
      created_at: '2026-09-13T10:00:00.000Z',
      description: 'notes',
    };
    await t.changesRepository.writeMetadata(change);
    expect(await t.changesRepository.readMetadata('with-file')).toEqual(change);
    expect(
      JSON.parse(
        await readFile(
          t.noesis.resolve('changes', 'with-file', 'change.json'),
          'utf8',
        ),
      ),
    ).toEqual(change);

    await t.changesRepository.create('bare');
    const bare = await t.changesRepository.readMetadata('bare');
    expect(bare).toMatchObject({
      slug: 'bare',
      name: 'bare',
      key: '',
      type: 'chore',
      status: 'discovery',
      description: '',
    });
    expect(Date.parse(bare?.created_at ?? '')).not.toBeNaN();

    expect(await t.changesRepository.readMetadata('missing')).toBeNull();
  });
});
