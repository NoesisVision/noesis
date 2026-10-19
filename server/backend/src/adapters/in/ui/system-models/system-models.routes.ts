import { Hono } from 'hono';
import type { FindNewestSystemModelHandler } from '#backend/app/system-model/find-newest-system-model';
import type { ScanSystemModelHandler } from '#backend/app/system-model/scan-system-model';

export interface SystemModelsDeps {
  scanSystemModel: ScanSystemModelHandler;
  findNewestSystemModel: FindNewestSystemModelHandler;
}

/**
 * Mounted at `/ui/system-models`. The page scans as an agent's
 * `scan_system_model` does, with the scanner the server was started with, and
 * reads the model scanned last.
 */
export function createSystemModelsApp(deps: SystemModelsDeps) {
  const { scanSystemModel, findNewestSystemModel } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/newest', async (c) => {
      return c.json({ systemModel: await findNewestSystemModel.handle() });
    })

    .post('/', async (c) => {
      return c.json({ systemModel: await scanSystemModel.handle() }, 201);
    });
}
