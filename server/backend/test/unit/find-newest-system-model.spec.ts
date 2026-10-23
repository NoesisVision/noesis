import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { NoesisSystemModelsRepository } from '#backend/adapters/out/store/system-models.repository';
import { SystemModel } from '#backend/app/system-model/system-model';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;
let systemModels: NoesisSystemModelsRepository;
let dir: string;

beforeEach(async () => {
  t = await testNoesis();
  systemModels = new NoesisSystemModelsRepository(t.noesis);
  dir = t.noesis.resolve('graph', 'system-models');
});

afterEach(() => t.cleanup());

const OLDEST = '01a0d22d-0000-7000-8000-000000000000';
const OLDER = '01a0d22d-7f47-76b9-abd4-bd21d66a1d17';
const NEWEST = '01a0d22e-0000-7000-8000-000000000000';

const scan = (
  id: string,
  scannedAt: string,
  commit: string | null = null,
): SystemModel =>
  SystemModel.parse({ id, name: id, scanned_at: scannedAt, commit });

describe('Finding the newest system model', () => {
  it('finds none before the first scan', async () => {
    expect(await t.findNewestSystemModel.handle()).toBeNull();
  });

  it('finds the one scanned last, whatever order they were stored in', async () => {
    await systemModels.save(scan(OLDER, '2026-09-29T08:01:00.000Z'));
    await systemModels.save(scan(NEWEST, '2026-09-29T09:00:00.000Z'));
    await systemModels.save(scan(OLDEST, '2026-09-29T08:00:00.000Z'));

    expect(await t.findNewestSystemModel.handle()).toEqual(
      scan(NEWEST, '2026-09-29T09:00:00.000Z'),
    );
  });

  it('takes the highest id among scans of different commits in one minute', async () => {
    await systemModels.save(
      scan(NEWEST, '2026-09-29T08:00:30.000Z', 'aaaaaaa'),
    );
    await systemModels.save(scan(OLDER, '2026-09-29T08:00:10.000Z', 'bbbbbbb'));

    expect<unknown>((await t.findNewestSystemModel.handle())?.id).toBe(NEWEST);
  });

  it('reads the newest model only', async () => {
    await systemModels.save(scan(NEWEST, '2026-09-29T09:00:00.000Z'));
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/2026-09-29_08-00_uncommitted.json`, '{ broken');

    expect(await t.findNewestSystemModel.handle()).toEqual(
      scan(NEWEST, '2026-09-29T09:00:00.000Z'),
    );
    await expect(systemModels.list()).rejects.toThrow();
  });
});

describe('Storing a system model', () => {
  it('names the file by the scan minute in UTC and the commit', async () => {
    await systemModels.save(
      scan(NEWEST, '2026-10-22T11:57:44.851+02:00', '4b69653a'),
    );
    await systemModels.save(scan(OLDER, '2026-10-22T08:00:00.000Z'));

    expect((await readdir(dir)).sort()).toEqual([
      '2026-10-22_08-00_uncommitted.json',
      '2026-10-22_09-57_4b69653a.json',
    ]);
  });

  it('replaces a scan of the same commit in the same minute', async () => {
    await systemModels.save(
      scan(OLDER, '2026-10-22T08:00:05.000Z', '4b69653a'),
    );
    await systemModels.save(
      scan(NEWEST, '2026-10-22T08:00:50.000Z', '4b69653a'),
    );

    expect<unknown>((await systemModels.list()).map(({ id }) => id)).toEqual([
      NEWEST,
    ]);
  });

  it('finds a scan by its id, and lists every scan by id', async () => {
    await systemModels.save(scan(NEWEST, '2026-09-29T08:00:00.000Z'));
    await systemModels.save(scan(OLDER, '2026-09-29T09:00:00.000Z'));

    expect<unknown>((await systemModels.get(OLDER as never))?.id).toBe(OLDER);
    expect<unknown>((await systemModels.list()).map(({ id }) => id)).toEqual([
      OLDER,
      NEWEST,
    ]);
  });
});
