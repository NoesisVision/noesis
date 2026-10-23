import { existsSync, rmSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ZodType } from 'zod';
import {
  createJsonFile,
  JsonFileError,
  parseJson,
  writeJsonFile,
} from './json-file';

/** How the entities of one directory map to file names. */
export interface FileLayout<T extends { id: string }> {
  /** The file `entity` is stored in. */
  nameOf(entity: T): string;
  /** The file for `id` when the id alone names it; `null` when the name comes from the content. */
  nameOfId(id: T['id']): string | null;
  /** Whether a file in the directory belongs to the collection. */
  holds(name: string): boolean;
  /** Why a file the collection holds is misnamed; `null` when its name is fine. */
  misnaming(name: string): string | null;
}

/** What may name a file: dated ids and content hashes fit, a path never does. */
const FILE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** `<id>.<kind>.json`: the id names the file, so a get reads that file only. */
export function byId<T extends { id: string }>(kind: string): FileLayout<T> {
  const suffix = `.${kind}.json`;
  const nameOfId = (id: string): string => {
    if (!FILE_NAME_PATTERN.test(id)) {
      throw new Error(
        `Invalid id ${JSON.stringify(id)}; ids match ${FILE_NAME_PATTERN}.`,
      );
    }
    return `${id}${suffix}`;
  };
  return {
    nameOf: (entity) => nameOfId(entity.id),
    nameOfId,
    holds: (name) => name.endsWith(suffix),
    misnaming: (name) =>
      FILE_NAME_PATTERN.test(name.slice(0, -suffix.length))
        ? null
        : `the file name is not an id; ids match ${FILE_NAME_PATTERN}.`,
  };
}

/** The content names the file, so a get by id reads every file. */
export function nameFromContent<T extends { id: string }>(
  pattern: RegExp,
  nameOf: (entity: T) => string,
): FileLayout<T> {
  return {
    nameOf,
    nameOfId: () => null,
    holds: (name) => pattern.test(name),
    misnaming: () => null,
  };
}

/**
 * One entity per file in `dir`, named by its layout; a file must hold the
 * entity its name says. No locks. A create is exclusive, across processes
 * too, so no two writers take one file. A replace or a delete checks the file
 * is there and acts without yielding, so nothing else in this process comes
 * between the two; another process can, and then the last complete write
 * wins.
 */
export class JsonCollection<T extends { id: string }> {
  private readonly schema: ZodType<T>;
  private readonly dir: string;
  private readonly layout: FileLayout<T>;

  constructor(schema: ZodType<T>, dir: string, layout: FileLayout<T>) {
    this.schema = schema;
    this.dir = dir;
    this.layout = layout;
  }

  /** `null` when absent; a `JsonFileError` when the file is broken. */
  async get(id: T['id']): Promise<T | null> {
    const name = this.layout.nameOfId(id);
    if (name !== null) return this.read(name);
    return (await this.list()).find((entity) => entity.id === id) ?? null;
  }

  /** By id ascending; throws on the first broken file. */
  async list(): Promise<T[]> {
    return this.readAll(await this.names());
  }

  /** The collection's file names, by code unit. Reads no file. */
  async names(): Promise<string[]> {
    const names = (await readdirIfExists(this.dir)).filter((name) =>
      this.layout.holds(name),
    );
    for (const name of names) this.assertWellNamed(name);
    return names.sort(byCodeUnit);
  }

  /** The named files, by id ascending; one gone since it was listed is skipped. */
  async readAll(names: string[]): Promise<T[]> {
    const entities = await Promise.all(names.map((name) => this.read(name)));
    return entities
      .filter((entity) => entity !== null)
      .sort((a, b) => byCodeUnit(a.id, b.id));
  }

  // Each write is `async` without awaiting anything: its body runs in one
  // step, and a refused id rejects instead of throwing before the promise
  // exists.

  /** Writes `entity` where none is yet; `false` when its file is taken. */
  async create(entity: T): Promise<boolean> {
    return createJsonFile(this.pathOf(entity), this.schema, entity);
  }

  /** Replaces the stored entity whole; `false` when there is none. */
  async replace(entity: T): Promise<boolean> {
    const path = this.pathOf(entity);
    if (!existsSync(path)) return false;
    writeJsonFile(path, this.schema, entity);
    return true;
  }

  /** Writes `entity`, over whatever its file held. */
  async save(entity: T): Promise<void> {
    writeJsonFile(this.pathOf(entity), this.schema, entity);
  }

  /** Removes the entity's file; `false` when there is none. Only where the id names the file. */
  async delete(id: T['id']): Promise<boolean> {
    const path = this.pathOfId(id);
    if (!existsSync(path)) return false;
    rmSync(path, { force: true });
    return true;
  }

  private pathOf(entity: T): string {
    return join(this.dir, this.layout.nameOf(entity));
  }

  private pathOfId(id: T['id']): string {
    const name = this.layout.nameOfId(id);
    if (name === null) {
      throw new Error(`${this.dir} names its files by content, not by id.`);
    }
    return join(this.dir, name);
  }

  private assertWellNamed(name: string): void {
    const problem = this.layout.misnaming(name);
    if (problem !== null)
      throw new JsonFileError(join(this.dir, name), problem);
  }

  /** A file gone since `readdir` (a `git checkout` under the walk) is absent, not broken. */
  private async read(name: string): Promise<T | null> {
    const path = join(this.dir, name);
    const text = await readFileIfExists(path);
    if (text === null) return null;
    const result = parseJson(text, this.schema);
    if (result.isErr()) throw new JsonFileError(path, result.error);
    this.assertNamedBy(result.value, path, name);
    return result.value;
  }

  private assertNamedBy(entity: T, path: string, name: string): void {
    const expected = this.layout.nameOf(entity);
    if (expected !== name) {
      throw new JsonFileError(
        path,
        `its content does not match its file name; it belongs in ${expected}.`,
      );
    }
  }
}

/** Ids are ASCII, so code-unit order is alphabetical without a locale. */
function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

async function readdirIfExists(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
}

async function readFileIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}
