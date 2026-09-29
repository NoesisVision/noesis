import { SystemModel } from '#backend/app/system-model/system-model';
import type { SystemModelsRepository } from '#backend/app/system-model/system-models.repository';
import { JsonCollection } from '#backend/platform/files/json-collection';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** One `graph/system-models/<id>.system-model.json` per scanned unit. */
export class NoesisSystemModelsRepository implements SystemModelsRepository {
  private readonly systemModels: JsonCollection<SystemModel>;

  constructor(noesis: NoesisDir) {
    this.systemModels = new JsonCollection(
      SystemModel,
      noesis.resolve('graph', 'system-models'),
      'system-model',
    );
  }

  get(id: string): Promise<SystemModel | null> {
    return this.systemModels.get(id);
  }

  list(): Promise<SystemModel[]> {
    return this.systemModels.list();
  }

  async findNewest(): Promise<SystemModel | null> {
    const models = await this.systemModels.list();
    return models.reduce<SystemModel | null>(
      (newest, model) =>
        newest === null || scannedAt(model) > scannedAt(newest)
          ? model
          : newest,
      null,
    );
  }

  save(model: SystemModel): Promise<void> {
    return this.systemModels.put(model);
  }
}

/** Compared as instants, so an offset other than `Z` still orders right. */
function scannedAt(model: SystemModel): number {
  return Date.parse(model.scanned_at);
}
