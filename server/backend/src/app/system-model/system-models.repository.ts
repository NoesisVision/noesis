import type { SystemModel } from './system-model';

export interface SystemModelsRepository {
  get(id: string): Promise<SystemModel | null>;

  /** By id ascending. */
  list(): Promise<SystemModel[]>;

  /**
   * The model scanned last, comparing scan times as instants; `null` before
   * the first scan. Of two scanned at the same moment, the lower id wins.
   */
  findNewest(): Promise<SystemModel | null>;

  /** Writes `model`, replacing the one stored at its id, if any. */
  save(model: SystemModel): Promise<void>;
}

/** What a query may touch: the methods that read. */
export type SystemModelsReader = Pick<
  SystemModelsRepository,
  'get' | 'list' | 'findNewest'
>;
