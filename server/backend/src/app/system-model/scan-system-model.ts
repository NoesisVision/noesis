import type { Handler } from '#backend/app/handler';
import { ScanFailedError } from './scan-failed-error';
import type { SystemModel } from './system-model';
import type { SystemModelsRepository } from './system-models.repository';

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
