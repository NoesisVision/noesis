import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { NoesisSystemModelsRepository } from '#backend/adapters/out/store/system-models.repository';
import { SystemModel } from '#backend/app/system-model/system-model';
import { type TestNoesis, testNoesis } from './test-noesis';

let t: TestNoesis;
let systemModels: NoesisSystemModelsRepository;

beforeEach(async () => {
  t = await testNoesis();
  systemModels = new NoesisSystemModelsRepository(t.noesis);
});

afterEach(() => t.cleanup());

const OLDEST = '01a0d22d-0000-7000-8000-000000000000';
const OLDER = '01a0d22d-7f47-76b9-abd4-bd21d66a1d17';
const NEWEST = '01a0d22e-0000-7000-8000-000000000000';

const scan = (id: string): SystemModel =>
  SystemModel.parse({ id, name: id, scanned_at: '2026-09-29T08:00:00.000Z' });

describe('Finding the newest system model', () => {
  it('finds none before the first scan', async () => {
    expect(await t.findNewestSystemModel.handle()).toBeNull();
  });

  it('finds the one with the highest id, whatever order they were stored in', async () => {
    await systemModels.create(scan(OLDER));
    await systemModels.create(scan(NEWEST));
    await systemModels.create(scan(OLDEST));

    expect(await t.findNewestSystemModel.handle()).toEqual(scan(NEWEST));
  });

  it('reads the newest model only', async () => {
    await systemModels.create(scan(NEWEST));
    const dir = t.noesis.resolve('graph', 'system-models');
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/${OLDER}.system-model.json`, '{ broken');

    expect(await t.findNewestSystemModel.handle()).toEqual(scan(NEWEST));
    await expect(systemModels.list()).rejects.toThrow();
  });
});
