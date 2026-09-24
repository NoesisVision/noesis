import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Change } from '#backend/app/changes/change';
import { ChangeId } from '#backend/app/changes/change-id';
import { DesignDocumentSchema } from '#backend/app/design-docs/design-doc';
import { JsonFileError } from '#backend/platform/files/json-file';
import {
  decodedDesignDocFixture,
  designDocFixture,
} from '../fixtures/design-doc.fixture';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;

beforeEach(async () => {
  t = await testNoesis();
});

afterEach(() => t.cleanup());

const ids = async (): Promise<string[]> =>
  (await t.changesRepository.list()).map(({ id }) => id);

describe('NoesisChangesRepository', () => {
  it('lists nothing before the first change, then every id written, ascending', async () => {
    expect(await ids()).toEqual([]);

    const audit = await t.createChange('2026-01-02-audit-log');
    await t.createChange('2026-01-01-payment-retry');

    expect(await ids()).toEqual([
      '2026-01-01-payment-retry',
      '2026-01-02-audit-log',
    ]);
    expect(await t.changesRepository.get(audit)).not.toBeNull();
    expect(
      await t.changesRepository.get(ChangeId.parse('2026-01-01-missing')),
    ).toBeNull();
  });

  it('ignores folders, dot entries and foreign files under changes/', async () => {
    await mkdir(join(t.changesDir, '.hidden'), { recursive: true });
    await mkdir(join(t.changesDir, '2026-01-01-orphan'), { recursive: true });
    await writeFile(join(t.changesDir, 'README.md'), 'notes');
    await t.createChange('2026-01-01-real');

    expect(await ids()).toEqual(['2026-01-01-real']);
    expect(
      await t.changesRepository.get(ChangeId.parse('2026-01-01-orphan')),
    ).toBeNull();
  });

  it('refuses to list a change file that is not a change', async () => {
    await t.createChange('2026-01-01-real');
    await writeFile(
      join(t.changesDir, 'payment-retry.change.json'),
      JSON.stringify({ id: 'payment-retry', name: 'x', type: 'chore' }),
    );

    await expect(t.changesRepository.list()).rejects.toBeInstanceOf(
      JsonFileError,
    );
  });

  it('round-trips a change through graph/changes/<id>.change.json', async () => {
    const change: Change = {
      id: ChangeId.parse('2026-01-01-with-file'),
      name: 'With file',
      key: 'NOE-1',
      type: 'feature',
      status: 'design',
      description: 'notes',
    };
    await t.changesRepository.save(change);

    expect(await t.changesRepository.get(change.id)).toEqual(change);
    expect(await readdir(t.changesDir)).toEqual([
      '2026-01-01-with-file.change.json',
    ]);
    expect(
      JSON.parse(
        await readFile(
          join(t.changesDir, '2026-01-01-with-file.change.json'),
          'utf8',
        ),
      ),
    ).toEqual(change);
  });

  it('replaces the change and keeps what it owns', async () => {
    const kept = await t.createChange('2026-01-01-kept', {
      status: 'discovery',
    });
    await t.writeDesignDoc(kept, designDocFixture);
    const before = await t.changesRepository.get(kept);
    if (before === null) throw new Error('the change was not written');

    await t.changesRepository.save({ ...before, status: 'design' });

    expect((await t.changesRepository.get(kept))?.status).toBe('design');
    expect(
      await t.designDocsRepository.get(kept, decodedDesignDocFixture.id),
    ).toEqual(DesignDocumentSchema.parse(designDocFixture));
    expect((await readdir(join(t.changesDir, kept))).sort()).toEqual([
      `${designDocFixture.id}.design-doc.json`,
    ]);
  });

  it('refuses data whose id is not one, and data that is not a change', async () => {
    const typed = await t.createChange('2026-01-01-typed');
    const before = await t.changesRepository.get(typed);
    if (before === null) throw new Error('the change was not written');

    await expect(
      t.changesRepository.save({
        ...before,
        id: 'Not An Id',
      } as unknown as typeof before),
    ).rejects.toThrow();
    await expect(
      t.changesRepository.save({
        ...before,
        status: 'shipped',
      } as unknown as typeof before),
    ).rejects.toBeInstanceOf(JsonFileError);
    expect((await t.changesRepository.get(typed))?.status).toBe('discovery');
  });
});
