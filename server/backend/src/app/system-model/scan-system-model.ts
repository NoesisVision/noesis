import type { Handler } from '#backend/app/handler';
import type { SourceCodeScanner } from './source-code-scanner';
import type { SystemModel } from './system-model';
import { SystemModelId } from './system-model-id';
import type { SystemModelsRepository } from './system-models.repository';

export type ScanSystemModelHandler = Handler<void, SystemModel>;

export function scanSystemModelHandler(
  scanner: SourceCodeScanner,
  systemModels: SystemModelsRepository,
): ScanSystemModelHandler {
  return {
    /**
     * Scans the code and stores the model found beside the ones before, at
     * an id minted as the scan starts, so the newest scan has the highest id.
     */
    async handle() {
      const id = SystemModelId.mint();
      const model: SystemModel = { ...(await scanner.scan()), id };
      if (!(await systemModels.create(model))) {
        throw new Error(`System model ${id} is already stored.`);
      }
      return model;
    },
  };
}
