import type { SystemModel } from './system-model';
import type { SystemModelId } from './system-model-id';

/** Every scan's model, kept; ids sort by scan time. */
export interface SystemModelsRepository {
  get(id: SystemModelId): Promise<SystemModel | null>;

  /** By id ascending: oldest scan first. */
  list(): Promise<SystemModel[]>;

  /**
   * The model with the highest id, which is the one scanned last; `null`
   * before the first scan. Reads that model only.
   */
  findNewest(): Promise<SystemModel | null>;

  /** Writes `model`, replacing a scan of the same commit in the same minute. */
  save(model: SystemModel): Promise<void>;
}

/** What a query may touch: the methods that read. */
export type SystemModelsReader = Pick<
  SystemModelsRepository,
  'get' | 'list' | 'findNewest'
>;
