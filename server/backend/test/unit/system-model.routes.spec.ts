import { afterAll, describe, expect, it } from 'bun:test';
import { createUiApp } from '#backend/adapters/in/ui/ui.routes';
import { NoesisSystemModelsRepository } from '#backend/adapters/out/store/system-models.repository';
import { scanSystemModelHandler } from '#backend/app/system-model/scan-system-model';
import { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import { testNoesis } from './test-noesis';

const t = await testNoesis();
afterAll(() => t.cleanup());

const shop = SystemModel.parse({
  id: SystemModelId.mint(),
  name: 'shop',
  scanned_at: '2026-10-21T08:00:00.000Z',
  modules: [
    {
      id: 'module|Sales',
      name: 'Sales',
      description: null,
      source: { path: 'Sales/Sales.cs', line: 1 },
    },
  ],
});

/** The surface over a scanner that finds `model`, or fails with `failure`. */
function surface(model: SystemModel | Error) {
  const systemModels = new NoesisSystemModelsRepository(t.noesis);
  return createUiApp({
    ...t,
    scanSystemModel: scanSystemModelHandler(
      {
        scan: () =>
          model instanceof Error
            ? Promise.reject(model)
            : Promise.resolve(model),
      },
      systemModels,
    ),
  });
}

describe('GET /system-model', () => {
  it('answers null before the first scan', async () => {
    const res = await surface(shop).request('/system-model');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ systemModel: null });
  });
});

describe('POST /system-model/scan', () => {
  it('scans, stores the model and answers it counted; GET then lists it as newest', async () => {
    const app = surface(shop);

    const res = await app.request('/system-model/scan', { method: 'POST' });

    expect(res.status).toBe(201);
    const summary = {
      id: shop.id,
      name: 'shop',
      scanned_at: shop.scanned_at,
      modules: 1,
      buildingBlocks: 0,
      behaviours: 0,
    };
    expect(await res.json()).toEqual({ systemModel: summary });
    expect(await (await app.request('/system-model')).json()).toEqual({
      systemModel: summary,
    });
  });

  it("answers a failed scan with the scanner's reason", async () => {
    const res = await surface(
      new Error('noesis-config.json names no scanner.'),
    ).request('/system-model/scan', { method: 'POST' });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: 'scan_failed',
      message: 'noesis-config.json names no scanner.',
    });
  });
});
