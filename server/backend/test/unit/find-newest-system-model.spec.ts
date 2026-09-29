import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
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

const model = (id: string, scannedAt: string): SystemModel =>
  SystemModel.parse({ id, name: id, scanned_at: scannedAt });

describe('Finding the newest system model', () => {
  it('finds none before the first scan', async () => {
    expect(await t.findNewestSystemModel.handle()).toBeNull();
  });

  it('finds the one scanned last, whatever its id', async () => {
    await systemModels.save(model('a', '2026-09-29T08:00:00.000Z'));
    await systemModels.save(model('b', '2026-09-29T10:00:00.000Z'));
    await systemModels.save(model('c', '2026-09-28T12:00:00.000Z'));

    expect(await t.findNewestSystemModel.handle()).toEqual(
      model('b', '2026-09-29T10:00:00.000Z'),
    );
  });

  it('compares scan times as instants, not as text', async () => {
    await systemModels.save(model('a', '2026-09-29T09:00:00.000Z'));
    await systemModels.save(model('b', '2026-09-29T10:30:00.000+02:00'));

    expect((await t.findNewestSystemModel.handle())?.id).toBe('a');
  });

  it('takes the lower id of two scanned at the same moment', async () => {
    await systemModels.save(model('b', '2026-09-29T08:00:00.000Z'));
    await systemModels.save(model('a', '2026-09-29T08:00:00.000Z'));

    expect((await t.findNewestSystemModel.handle())?.id).toBe('a');
  });
});
