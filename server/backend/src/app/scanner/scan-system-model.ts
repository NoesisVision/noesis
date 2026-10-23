import type { Handler } from '#backend/app/handler';
import type { SystemModel } from '#backend/app/scanner/system-model/system-model';
import type { SystemModelsRepository } from '#backend/app/scanner/system-model/system-models.repository';
import { ScanFailedError } from './scan-failed-error';

export type ScanSystemModelHandler = Handler<void, SystemModel>;

/**
 * Builds the scanner the repository's settings name, anew at every scan.
 * Typed apart from SourceCodeScanner: the handler is reachable from AppType,
 * which must not reach the builder's Node imports.
 */
export interface Scanners {
  create(): Promise<{ scan(): Promise<SystemModel> }>;
}

export function scanSystemModelHandler(
  scanners: Scanners,
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
