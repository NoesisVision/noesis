import type { SystemModelsRepository } from '#backend/app/scanner/system-model/system-models.repository';
import { ScanFailedError } from './scan-failed-error';
import type { ScanSystemModelHandler } from './scan-system-model.port';
import type { ScannerFactory } from './scanner-factory';

export function scanSystemModelHandler(
  scanners: ScannerFactory,
  systemModels: SystemModelsRepository,
): ScanSystemModelHandler {
  return {
    /** Scans the code and stores the model found beside the ones before. */
    async handle() {
      const model = await scanners
        .create()
        .then((scanner) => scanner.scan())
        .catch((error: unknown) => {
          throw new ScanFailedError(error);
        });
      await systemModels.save(model);
      return model;
    },
  };
}
