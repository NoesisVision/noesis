import type { Handler } from '#backend/app/handler';
import type { SystemModel } from './system-model';
import type { SystemModelsReader } from './system-models.repository';

export type FindNewestSystemModelHandler = Handler<void, SystemModel | null>;

export function findNewestSystemModelHandler(
  systemModels: SystemModelsReader,
): FindNewestSystemModelHandler {
  return {
    /** The model scanned last; `null` before the first scan. */
    handle: () => systemModels.findNewest(),
  };
}
