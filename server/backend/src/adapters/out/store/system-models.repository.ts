import { SystemModel } from '#backend/app/system-model/system-model';
import type { SystemModelId } from '#backend/app/system-model/system-model-id';
import type { SystemModelsRepository } from '#backend/app/system-model/system-models.repository';
import {
  JsonCollection,
  nameFromContent,
} from '#backend/platform/files/json-collection';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';

/** `YYYY-MM-DD_HH-MM_<commit>.json`; the time is UTC, so names sort by scan time. */
const FILE_NAME =
  /^(\d{4}-\d{2}-\d{2}_\d{2}-\d{2})_([0-9a-f]{4,40}|uncommitted)\.json$/;
/** Stands in for the commit of a repository without one. */
const NO_COMMIT = 'uncommitted';

/**
 * One `graph/system-models/YYYY-MM-DD_HH-MM_<commit>.json` per scan, named
 * by the minute it was scanned at (UTC) and the commit it scanned. A scan in
 * the same minute on the same commit replaces the one before.
 */
export class SystemModelsFileRepository implements SystemModelsRepository {
  private readonly models: JsonCollection<SystemModel>;

  constructor(noesis: NoesisDir) {
    this.models = new JsonCollection(
      SystemModel,
      noesis.resolve('graph', 'system-models'),
      nameFromContent(FILE_NAME, fileNameOf),
    );
  }

  get(id: SystemModelId): Promise<SystemModel | null> {
    return this.models.get(id);
  }

  list(): Promise<SystemModel[]> {
    return this.models.list();
  }

  /** Reads only the files of the latest minute; of those, the highest id wins. */
  async findNewest(): Promise<SystemModel | null> {
    const names = await this.models.names();
    const latest = names.map(minuteOf).at(-1);
    if (latest === undefined) return null;
    const ofLatest = names.filter((name) => minuteOf(name) === latest);
    return (await this.models.readAll(ofLatest)).at(-1) ?? null;
  }

  save(model: SystemModel): Promise<void> {
    return this.models.save(model);
  }
}

/** `2026-10-22T09:57:44.851Z` on commit `4b69653a` → `2026-10-22_09-57_4b69653a.json`. */
function fileNameOf(model: SystemModel): string {
  const scannedAt = new Date(model.scanned_at);
  if (Number.isNaN(scannedAt.getTime())) {
    throw new Error(
      `System model ${model.id} has no valid scan time: ${model.scanned_at}`,
    );
  }
  const minute = scannedAt
    .toISOString()
    .slice(0, 16)
    .replace('T', '_')
    .replace(':', '-');
  return `${minute}_${model.commit ?? NO_COMMIT}.json`;
}

function minuteOf(name: string): string {
  return FILE_NAME.exec(name)?.[1] ?? '';
}
