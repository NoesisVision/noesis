import { type SystemModel, SystemModelSchema } from '@repo/shared-contracts';
import { FileRepository, type StoredFile } from '../files/file-repository.js';
import type { NoesisDir } from '../files/noesis-dir.js';

export type StoredSystemModel = StoredFile<SystemModel>;

/**
 * `.noesis/system-model/`: the implemented model as the scanner projects it,
 * one file per scanned unit. Written by the scanner only; a hand edit is
 * overwritten by the next scan, so nothing here carries locks.
 */
export class SystemModelRepository {
  private readonly files: FileRepository<SystemModel>;

  constructor(noesis: NoesisDir) {
    this.files = new FileRepository<SystemModel>({
      dir: noesis.resolve('system-model'),
      slugOf: (m) => m.name,
      decode: (raw) => SystemModelSchema.parse(raw),
    });
  }

  write(model: SystemModel): Promise<StoredSystemModel> {
    return this.files.write(model);
  }

  findById(id: string): Promise<StoredSystemModel | null> {
    return this.files.read(id);
  }

  remove(id: string): Promise<boolean> {
    return this.files.remove(id);
  }

  /** Sorted by name. */
  async list(): Promise<StoredSystemModel[]> {
    const stored = await this.files.list();
    return stored.sort((a, b) => a.entity.name.localeCompare(b.entity.name));
  }
}
