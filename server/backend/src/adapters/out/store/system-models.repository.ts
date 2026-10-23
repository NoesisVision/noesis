import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SystemModel } from '#backend/app/scanner/system-model/system-model';
import type { SystemModelId } from '#backend/app/scanner/system-model/system-model-id';
import type { SystemModelsRepository } from '#backend/app/scanner/system-model/system-models.repository';
import {
  JsonFileError,
  readJsonFile,
  writeJsonFile,
} from '#backend/platform/files/json-file';
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
  private readonly dir: string;

  constructor(noesis: NoesisDir) {
    this.dir = noesis.resolve('graph', 'system-models');
  }

  async get(id: SystemModelId): Promise<SystemModel | null> {
    return (await this.list()).find((model) => model.id === id) ?? null;
  }

  async list(): Promise<SystemModel[]> {
    const models = await Promise.all(
      (await this.fileNames()).map((name) => this.read(name)),
    );
    return models.sort(byId);
  }

  /** Reads only the files of the latest minute; of those, the highest id wins. */
  async findNewest(): Promise<SystemModel | null> {
    const names = await this.fileNames();
    const latest = names.map(minuteOf).sort().at(-1);
    if (latest === undefined) return null;
    const models = await Promise.all(
      names
        .filter((name) => minuteOf(name) === latest)
        .map((name) => this.read(name)),
    );
    return models.sort(byId).at(-1) ?? null;
  }

  async save(model: SystemModel): Promise<void> {
    writeJsonFile(join(this.dir, fileNameOf(model)), SystemModel, model);
  }

  private async fileNames(): Promise<string[]> {
    try {
      return (await readdir(this.dir)).filter((name) => FILE_NAME.test(name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  private async read(name: string): Promise<SystemModel> {
    const path = join(this.dir, name);
    return (await readJsonFile(path, SystemModel)).match(
      (model) => model,
      (message) => {
        throw new JsonFileError(path, message);
      },
    );
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

function byId(a: SystemModel, b: SystemModel): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
