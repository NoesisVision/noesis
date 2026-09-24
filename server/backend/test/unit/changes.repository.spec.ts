import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ChangeId } from '#backend/app/changes/change-id';
import { DesignDocumentSchema } from '#backend/app/design-docs/design-doc';
import { NoesisStoreError } from '#backend/platform/files/noesis-store';
import { designDocFixture } from '../fixtures/design-doc.fixture';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;

beforeEach(async () => {
  t = await testNoesis();
});

afterEach(() => t.cleanup());

const keys = async (): Promise<string[]> =>
  (await Array.fromAsync(t.changesRepository.keys())).sort();

describe('NoesisChangesRepository', () => {
  it('lists nothing before the first change, then every id written', async () => {
    expect(await keys()).toEqual([]);

    await t.createChange('2026-01-01-payment-retry');
    const audit = await t.createChange('2026-01-02-audit-log');

    expect(await keys()).toEqual([
      '2026-01-01-payment-retry',
      '2026-01-02-audit-log',
    ]);
    expect(await t.changesRepository.read(audit)).not.toBeNull();
    expect(
      await t.changesRepository.read(ChangeId.parse('2026-01-01-missing')),
    ).toBeNull();
  });

  it('ignores files, dot entries and directories without data.json under changes/', async () => {
    const changes = t.noesis.resolve('graph', 'changes');
    await mkdir(join(changes, '.hidden'), { recursive: true });
    await mkdir(join(changes, '2026-01-01-bare'), { recursive: true });
    await writeFile(join(changes, 'README.md'), 'notes');
    await t.createChange('2026-01-01-real');

    expect(await keys()).toEqual(['2026-01-01-real']);
    expect(
      await t.changesRepository.read(ChangeId.parse('2026-01-01-bare')),
    ).toBeNull();
  });

  it('skips a key the store lists that is not a change id', async () => {
    const foreign = t.noesis.resolve('graph', 'changes', 'payment-retry');
    await mkdir(foreign, { recursive: true });
    await writeFile(join(foreign, 'data.json'), '{}');
    await t.createChange('2026-01-01-real');

    expect(await keys()).toEqual(['2026-01-01-real']);
  });

  it('names the change directory and hands out its child collections', () => {
    const real = ChangeId.parse('2026-01-01-real');
    expect(t.changesRepository.dirOf(real)).toBe(
      t.noesis.resolve('graph', 'changes', '2026-01-01-real'),
    );
    const children = t.changesRepository.children(real);
    expect(children['design-docs'].directory).toBe(
      t.noesis.resolve('graph', 'changes', '2026-01-01-real', 'design-docs'),
    );
    expect(children.documents.directory).toBe(
      t.noesis.resolve('graph', 'changes', '2026-01-01-real', 'documents'),
    );
  });

  it('round-trips a change through graph/changes/<id>/data.json', async () => {
    const change = {
      id: ChangeId.parse('2026-01-01-with-file'),
      name: 'With file',
      key: 'NOE-1',
      type: 'feature' as const,
      status: 'design' as const,
      description: 'notes',
    };
    await t.changesRepository.write(change);
    expect(
      await t.changesRepository.read(ChangeId.parse('2026-01-01-with-file')),
    ).toEqual(change);
    expect(
      JSON.parse(
        await readFile(
          t.noesis.resolve(
            'graph',
            'changes',
            '2026-01-01-with-file',
            'data.json',
          ),
          'utf8',
        ),
      ),
    ).toEqual(change);
  });

  it('replaces the data and keeps what the change owns', async () => {
    const kept = await t.createChange('2026-01-01-kept', {
      status: 'discovery',
    });
    const owned = t.changesRepository.children(kept)['design-docs'];
    await owned.set(designDocFixture.id, designDocFixture);
    const before = await t.changesRepository.read(kept);
    if (before === null) throw new Error('the change was not written');

    await t.changesRepository.write({ ...before, status: 'design' });

    expect((await t.changesRepository.read(kept))?.status).toBe('design');
    expect(await owned.get(designDocFixture.id)).toEqual(
      DesignDocumentSchema.parse(designDocFixture),
    );
  });

  it('refuses data whose id is not one, and data that is not a change', async () => {
    const typed = await t.createChange('2026-01-01-typed');
    const before = await t.changesRepository.read(typed);
    if (before === null) throw new Error('the change was not written');

    await expect(
      t.changesRepository.write({
        ...before,
        id: 'Not An Id',
      } as unknown as typeof before),
    ).rejects.toThrow();
    await expect(
      t.changesRepository.write({
        ...before,
        status: 'shipped',
      } as unknown as typeof before),
    ).rejects.toBeInstanceOf(NoesisStoreError);
    expect((await t.changesRepository.read(typed))?.status).toBe('discovery');
  });
});
