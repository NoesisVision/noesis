import type { Handler } from '#backend/app/handler';
import { graphOf, type SystemModelGraph } from './system-model-graph';
import type { SystemModelsReader } from './system-models.repository';

export type FindSystemModelGraphHandler = Handler<
  void,
  SystemModelGraph | null
>;

export function findSystemModelGraphHandler(
  systemModels: SystemModelsReader,
): FindSystemModelGraphHandler {
  return {
    /** The newest model as a graph; `null` before the first scan. */
    async handle() {
      const model = await systemModels.findNewest();
      return model === null ? null : graphOf(model);
    },
  };
}
