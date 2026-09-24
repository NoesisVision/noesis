import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ZodType } from 'zod';
import { JsonFileError, readJsonFile, writeJsonFile } from './json-file';

/** What may name a file: dated ids and content hashes fit, a path never does. */
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * One entity per file, `<dir>/<id>.<kind>.json`. No locks: the atomic rename
 * in `writeJsonFile` is the whole guarantee, so the last complete write wins,
 * across processes too.
 */
export class JsonCollection<T extends { id: string }> {
  private readonly schema: ZodType<T>;
  private readonly dir: string;
  private readonly suffix: string;

  constructor(schema: ZodType<T>, dir: string, kind: string) {
    this.schema = schema;
    this.dir = dir;
    this.suffix = `.${kind}.json`;
  }

  /** `null` when absent; a `JsonFileError` when the file is broken. */
  async get(id: string): Promise<T | null> {
    return this.read(id, this.pathOf(id));
  }

  /** By id ascending; throws on the first broken file. */
  async list(): Promise<T[]> {
    const ids = (await this.listIds()).sort();
    const entities = await Promise.all(
      ids.map((id) => this.read(id, join(this.dir, this.fileName(id)))),
    );
    return entities.filter((entity) => entity !== null);
  }

  async save(entity: T): Promise<void> {
    return writeJsonFile(this.pathOf(entity.id), this.schema, entity);
  }

  async delete(id: string): Promise<boolean> {
    const file = Bun.file(this.pathOf(id));
    if (!(await file.exists())) return false;
    await file.delete();
    return true;
  }

  pathOf(id: string): string {
    if (!ID_PATTERN.test(id)) {
      throw new Error(
        `Invalid id ${JSON.stringify(id)}; ids match ${ID_PATTERN}.`,
      );
    }
    return join(this.dir, this.fileName(id));
  }

  private fileName(id: string): string {
    return `${id}${this.suffix}`;
  }

  private async listIds(): Promise<string[]> {
    const names = await readdirIfExists(this.dir);
    return names
      .filter((name) => name.endsWith(this.suffix))
      .map((name) => name.slice(0, -this.suffix.length));
  }

  private async read(id: string, path: string): Promise<T | null> {
    if (!(await Bun.file(path).exists())) return null;
    if (!ID_PATTERN.test(id)) {
      throw new JsonFileError(
        path,
        `the file name is not an id; ids match ${ID_PATTERN}.`,
      );
    }
    const result = await readJsonFile(path, this.schema);
    if (result.isErr()) {
      // A file removed since the existence check (a `git checkout` under the
      // walk) is absent, not broken.
      if (!(await Bun.file(path).exists())) return null;
      throw new JsonFileError(path, result.error);
    }
    if (result.value.id !== id) {
      throw new JsonFileError(
        path,
        `its id ${JSON.stringify(result.value.id)} does not match its file name.`,
      );
    }
    return result.value;
  }
}

async function readdirIfExists(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
