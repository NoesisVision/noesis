import { Hono } from 'hono';
import type { FindNewestSystemModelHandler } from '#backend/app/system-model/find-newest-system-model';
import type { ScanSystemModelHandler } from '#backend/app/system-model/scan-system-model';
import { summarizeSystemModel } from '#backend/app/system-model/system-model-summary';

export interface SystemModelDeps {
  scanSystemModel: ScanSystemModelHandler;
  findNewestSystemModel: FindNewestSystemModelHandler;
}

/**
 * Mounted at `/ui/system-model`. The page shows the newest scan and runs a
 * new one with the scanner the repository configures; a scan that fails
 * answers `scan_failed` with the scanner's reason.
 */
export function createSystemModelApp(deps: SystemModelDeps) {
  const { scanSystemModel, findNewestSystemModel } = deps;

  // Keep the chain unbroken so Hono can infer the route types for the RPC client.
  return new Hono()
    .get('/', async (c) => {
      const model = await findNewestSystemModel.handle();
      return c.json({
        systemModel: model === null ? null : summarizeSystemModel(model),
      });
    })

    .post('/scan', async (c) => {
      const model = await scanSystemModel.handle();
      return c.json({ systemModel: summarizeSystemModel(model) }, 201);
    });
}
