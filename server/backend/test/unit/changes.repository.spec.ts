import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Change } from '#backend/app/changes/model/change';
import { ChangeId } from '#backend/app/changes/model/change-id';
import { CreateChange } from '#backend/app/changes/model/change-snapshot';
import { CreateSourceDocument } from '#backend/app/changes/model/source-document';
import { ConcurrentModificationError } from '#backend/app/concurrent-modification-error';
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

const read = async (id: ChangeId): Promise<Change> => {
  const change = await t.changesRepository.get(id);
  if (change === null) throw new Error(`no change ${id}`);
  return change;
};

describe('NoesisChangesRepository', () => {
  it('lists nothing before the first change, then every id written, ascending', async () => {
    expect(await ids()).toEqual([]);

    const audit = await t.writeChange('2026-01-02-audit-log');
    await t.writeChange('2026-01-01-payment-retry');

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
    await t.writeChange('2026-01-01-real');

    expect(await ids()).toEqual(['2026-01-01-real']);
    expect(
      await t.changesRepository.get(ChangeId.parse('2026-01-01-orphan')),
    ).toBeNull();
  });

  it('refuses to list a change file that is not a change', async () => {
    await t.writeChange('2026-01-01-real');
    await writeFile(
      join(t.changesDir, 'payment-retry.change.json'),
      JSON.stringify({ id: 'payment-retry', name: 'x', type: 'chore' }),
    );

    await expect(t.changesRepository.list()).rejects.toBeInstanceOf(
      JsonFileError,
    );
  });

  it('refuses to read a change file without a version', async () => {
    const id = await t.writeChange('2026-01-01-unversioned');
    const path = join(t.changesDir, `${id}.change.json`);
    const { version: _, ...unversioned } = JSON.parse(
      await readFile(path, 'utf8'),
    ) as Record<string, unknown>;
    await writeFile(path, JSON.stringify(unversioned));

    await expect(t.changesRepository.get(id)).rejects.toBeInstanceOf(
      JsonFileError,
    );
  });

  it('round-trips a change and what it owns through graph/changes/<id>.change.json', async () => {
    const id = ChangeId.parse('2026-01-01-with-file');
    const change = Change.create(
      id,
      CreateChange.parse({
        name: 'With file',
        key: 'NOE-1',
        type: 'feature',
        description: 'notes',
      }),
    );
    change.addSourceDocument(
      CreateSourceDocument.parse({
        title: 'Notes',
        date: '2026-01-01',
        content: 'Said.',
      }),
    );
    await t.changesRepository.save(change);

    const expected = { ...change.toSnapshot(), version: 1 };
    expect((await read(id)).toSnapshot()).toEqual(expected);
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
    ).toEqual(expected);
  });

  it('stores a design document as its JSON form, defaults spelled out', async () => {
    const id = await t.writeChange('2026-01-01-designed');
    await t.writeDesignDoc(id, designDocFixture);

    const stored = JSON.parse(
      await readFile(join(t.changesDir, `${id}.change.json`), 'utf8'),
    ) as { designDocs: unknown[] };
    expect(stored.designDocs).toEqual([designDocFixture]);
    expect((await read(id)).designDoc(decodedDesignDocFixture.id)).toEqual(
      decodedDesignDocFixture,
    );
  });

  it('counts every save in the version, starting at 1', async () => {
    const id = await t.writeChange('2026-01-01-counted');
    expect((await read(id)).version).toBe(1);

    await t.changesRepository.save(await read(id));

    expect((await read(id)).version).toBe(2);
  });

  it('refuses a save on a version older than the stored one, keeping the stored one', async () => {
    const id = await t.writeChange('2026-01-01-raced');
    const first = await read(id);
    const second = await read(id);
    first.update({ ...first.summary(), status: 'design' });
    await t.changesRepository.save(first);

    second.update({ ...second.summary(), status: 'done' });

    await expect(t.changesRepository.save(second)).rejects.toBeInstanceOf(
      ConcurrentModificationError,
    );
    expect((await read(id)).summary().status).toBe('design');
  });

  it('refuses to create a change at an id another holds', async () => {
    const id = await t.writeChange('2026-01-01-taken');

    await expect(
      t.changesRepository.save(
        Change.create(id, CreateChange.parse({ name: 'Again', type: 'fix' })),
      ),
    ).rejects.toBeInstanceOf(ConcurrentModificationError);
  });

  it('refuses data whose id is not one, and data that is not a change', async () => {
    const typed = await t.writeChange('2026-01-01-typed');
    const before = (await read(typed)).toSnapshot();

    await expect(
      t.changesRepository.save(
        Change.fromSnapshot({
          ...before,
          id: 'Not An Id',
        } as unknown as typeof before),
      ),
    ).rejects.toThrow();
    await expect(
      t.changesRepository.save(
        Change.fromSnapshot({
          ...before,
          status: 'shipped',
        } as unknown as typeof before),
      ),
    ).rejects.toBeInstanceOf(JsonFileError);
    expect((await read(typed)).summary().status).toBe('discovery');
  });
});
