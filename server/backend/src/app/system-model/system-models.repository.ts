import type { SystemModel } from './system-model';

export interface SystemModelsRepository {
  get(id: string): Promise<SystemModel | null>;

  /** By id ascending. */
  list(): Promise<SystemModel[]>;

  /** Writes `model`, replacing the one stored at its id, if any. */
  save(model: SystemModel): Promise<void>;
}
