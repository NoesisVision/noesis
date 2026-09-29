import type { Handler } from '#backend/app/handler';
import type { SourceCodeScanner } from './source-code-scanner';
import type { SystemModel } from './system-model';
import type { SystemModelsRepository } from './system-models.repository';

export type ScanSystemModelHandler = Handler<void, SystemModel>;

export function scanSystemModelHandler(
  scanner: SourceCodeScanner,
  systemModels: SystemModelsRepository,
): ScanSystemModelHandler {
  return {
    /** Scans the code and stores the model found over the one before. */
    async handle() {
      const model = await scanner.scan();
      await systemModels.save(model);
      return model;
    },
  };
}
