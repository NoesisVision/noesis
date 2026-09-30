import { SystemModel } from '#backend/app/system-model/system-model';
import type { SystemModelId } from '#backend/app/system-model/system-model-id';
import type { SystemModelsRepository } from '#backend/app/system-model/system-models.repository';
import { JsonCollection } from '#backend/platform/files/json-collection';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** One `graph/system-models/<id>.system-model.json` per scan. */
export class NoesisSystemModelsRepository implements SystemModelsRepository {
  private readonly systemModels: JsonCollection<SystemModel>;

  constructor(noesis: NoesisDir) {
    this.systemModels = new JsonCollection(
      SystemModel,
      noesis.resolve('graph', 'system-models'),
      'system-model',
    );
  }

  get(id: SystemModelId): Promise<SystemModel | null> {
    return this.systemModels.get(id);
  }

  list(): Promise<SystemModel[]> {
    return this.systemModels.list();
  }

  /** A file gone between the listing and the read answers `null`; nothing here removes one. */
  async findNewest(): Promise<SystemModel | null> {
    const id = await this.systemModels.lastId();
    return id === null ? null : this.systemModels.get(id);
  }

  create(model: SystemModel): Promise<boolean> {
    return this.systemModels.create(model);
  }
}
