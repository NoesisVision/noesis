import { readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ZodType } from 'zod';
import { JsonFileError, parseJson, writeJsonFile } from './json-file';

/** What may name a file: dated ids and content hashes fit, a path never does. */
const FILE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** Ids are ASCII, so code-unit order is alphabetical without a locale. */
function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * One entity per file, `<dir>/<id>.<kind>.json`. No locks: the atomic rename
 * in `writeJsonFile` is the whole guarantee, so the last complete write wins,
 * across processes too, unless the writer checks what it replaces with
 * `saveIf`.
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

  /**
   * `null` when absent, a file gone since `readdir` (a `git checkout` under
   * the walk) included; a `JsonFileError` when the file is broken.
   */
  async get(id: string): Promise<T | null> {
    const path = this.pathOf(id);
    let text: string;
    try {
      text = await readFile(path, 'utf8');
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
    return this.decode(path, id, text);
  }

  /** By id ascending; throws on the first broken file. */
  async list(): Promise<T[]> {
    const ids = (await this.listIds()).sort(byCodeUnit);
    const entities = await Promise.all(ids.map((id) => this.get(id)));
    return entities.filter((entity) => entity !== null);
  }

  /**
   * Writes `entity` only when `accepts` takes the stored one, `null` when
   * there is none; answers whether it wrote. The read, the check and the
   * write never yield, so no other write of this process comes between them.
   * Another process still can.
   */
  saveIf(entity: T, accepts: (stored: T | null) => boolean): boolean {
    const path = this.pathOf(entity.id);
    const text = readFileIfExistsSync(path);
    const stored = text === null ? null : this.decode(path, entity.id, text);
    if (!accepts(stored)) return false;
    writeJsonFile(path, this.schema, entity);
    return true;
  }

  private pathOf(id: string): string {
    if (!FILE_NAME_PATTERN.test(id)) {
      throw new Error(
        `Invalid id ${JSON.stringify(id)}; ids match ${FILE_NAME_PATTERN}.`,
      );
    }
    return join(this.dir, `${id}${this.suffix}`);
  }

  private async listIds(): Promise<string[]> {
    const names = (await readdirIfExists(this.dir)).filter((name) =>
      name.endsWith(this.suffix),
    );
    for (const name of names) {
      if (!FILE_NAME_PATTERN.test(name.slice(0, -this.suffix.length))) {
        throw new JsonFileError(
          join(this.dir, name),
          `the file name is not an id; ids match ${FILE_NAME_PATTERN}.`,
        );
      }
    }
    return names.map((name) => name.slice(0, -this.suffix.length));
  }

  private decode(path: string, id: string, text: string): T {
    const result = parseJson(text, this.schema);
    if (result.isErr()) throw new JsonFileError(path, result.error);
    if (result.value.id !== id) {
      throw new JsonFileError(
        path,
        `its id ${JSON.stringify(result.value.id)} does not match its file name.`,
      );
    }
    return result.value;
  }
}

function readFileIfExistsSync(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

async function readdirIfExists(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}
