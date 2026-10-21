import type { SystemModel } from './system-model';

/** A scan as a list names it: id, name, time and counts, not the elements. */
export interface SystemModelSummary {
  id: SystemModel['id'];
  name: string;
  scanned_at: string;
  modules: number;
  buildingBlocks: number;
  behaviours: number;
}

export function summarizeSystemModel(model: SystemModel): SystemModelSummary {
  return {
    id: model.id,
    name: model.name,
    scanned_at: model.scanned_at,
    modules: model.modules.length,
    buildingBlocks: model.buildingBlocks.length,
    behaviours: model.behaviours.length,
  };
}
