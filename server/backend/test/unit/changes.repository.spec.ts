import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ChangeSlug } from '../../src/app/changes/change-slug.js';
import { NoesisStoreError } from '../../src/platform/files/noesis-store.js';
import { designDocFixture } from '../../src/shared/contracts/design-doc.fixture.js';
import { type TestNoesis, testNoesis } from './test-noesis.js';

let t: TestNoesis;

beforeEach(async () => {
  t = await testNoesis();
});

afterEach(() => t.cleanup());

const keys = async () =>
  (await Array.fromAsync(t.changesRepository.keys()))
    .map((slug) => slug.value)
    .sort();

describe('ChangesRepository', () => {
  it('lists nothing before the first change, then every slug written', async () => {
    expect(await keys()).toEqual([]);

    await t.createChange('payment-retry');
    const audit = await t.createChange('audit-log');

    expect(await keys()).toEqual(['audit-log', 'payment-retry']);
    expect(await t.changesRepository.read(audit)).not.toBeNull();
    expect(
      await t.changesRepository.read(ChangeSlug.parse('missing')),
    ).toBeNull();
  });

  it('ignores files, dot entries and directories without data.json under changes/', async () => {
    const changes = t.noesis.resolve('graph', 'changes');
    await mkdir(join(changes, '.hidden'), { recursive: true });
    await mkdir(join(changes, 'bare'), { recursive: true });
    await writeFile(join(changes, 'README.md'), 'notes');
    await t.createChange('real');

    expect(await keys()).toEqual(['real']);
    expect(await t.changesRepository.read(ChangeSlug.parse('bare'))).toBeNull();
  });

  it('skips a key the store lists that is not a change slug', async () => {
    const foreign = t.noesis.resolve('graph', 'changes', 'not_a_slug');
    await mkdir(foreign, { recursive: true });
    await writeFile(join(foreign, 'data.json'), '{}');
    await t.createChange('real');

    expect(await keys()).toEqual(['real']);
  });

  it('names the change directory and hands out its child collections', () => {
    const real = ChangeSlug.parse('real');
    expect(t.changesRepository.dirOf(real)).toBe(
      t.noesis.resolve('graph', 'changes', 'real'),
    );
    const children = t.changesRepository.children(real);
    expect(children['design-docs'].directory).toBe(
      t.noesis.resolve('graph', 'changes', 'real', 'design-docs'),
    );
    expect(children.conversations.directory).toBe(
      t.noesis.resolve('graph', 'changes', 'real', 'conversations'),
    );
    expect(children.documents.directory).toBe(
      t.noesis.resolve('graph', 'changes', 'real', 'documents'),
    );
  });

  it('round-trips a change through graph/changes/<slug>/data.json', async () => {
    const change = {
      slug: 'with-file',
      name: 'With file',
      key: 'NOE-1',
      type: 'feature' as const,
      status: 'design' as const,
      created_at: '2026-09-13T10:00:00.000Z',
      description: 'notes',
    };
    await t.changesRepository.write(change);
    expect(
      await t.changesRepository.read(ChangeSlug.parse('with-file')),
    ).toEqual(change);
    expect(
      JSON.parse(
        await readFile(
          t.noesis.resolve('graph', 'changes', 'with-file', 'data.json'),
          'utf8',
        ),
      ),
    ).toEqual(change);
  });

  it('replaces the data and keeps what the change owns', async () => {
    const kept = await t.createChange('kept', { status: 'discovery' });
    const owned = t.changesRepository.children(kept)['design-docs'];
    await owned.set(designDocFixture.id, designDocFixture);
    const before = await t.changesRepository.read(kept);
    if (before === null) throw new Error('the change was not written');

    await t.changesRepository.write({ ...before, status: 'design' });

    expect((await t.changesRepository.read(kept))?.status).toBe('design');
    expect(await owned.get(designDocFixture.id)).toEqual(designDocFixture);
  });

  it('refuses data whose slug is not one, and data that is not a change', async () => {
    const typed = await t.createChange('typed');
    const before = await t.changesRepository.read(typed);
    if (before === null) throw new Error('the change was not written');

    await expect(
      t.changesRepository.write({ ...before, slug: 'Not A Slug' }),
    ).rejects.toThrow('Not a change slug');
    await expect(
      t.changesRepository.write({
        ...before,
        status: 'shipped',
      } as unknown as typeof before),
    ).rejects.toBeInstanceOf(NoesisStoreError);
    expect((await t.changesRepository.read(typed))?.status).toBe('discovery');
  });
});
