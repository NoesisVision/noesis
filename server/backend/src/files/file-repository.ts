import { createHash, randomBytes } from 'node:crypto';
import type { Dirent } from 'node:fs';
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { serverLogger } from '../logging/logging.js';

const log = serverLogger('files');

/** One entity as it sits on disk. `hash` is the SHA-256 of the file bytes. */
export interface StoredFile<T> {
  entity: T;
  path: string;
  hash: string;
  /** The file's modification time, ISO 8601. */
  updatedAt: string;
}

/**
 * A cross-file reference: the target's id plus the hash of its file at the
 * time the link was made. The hash is how a dependent learns it has gone
 * stale — the mechanism that survives a branch switch.
 */
export interface FileRef {
  id: string;
  hash: string;
}

export type FileRefStatus = 'fresh' | 'stale' | 'missing';

export interface FileRepositoryOptions<T extends object> {
  /** The kind directory; created on the first write. */
  dir: string;
  /**
   * The field holding the entity id (`id` unless the contract names it
   * otherwise — `conversation_id`, `document_id`). Its value is a string.
   */
  idKey?: keyof T & string;
  /** The human part of the file name, kebab-cased and capped by `slugify`. */
  slugOf: (entity: T) => string;
  /**
   * Turns parsed JSON into the entity — a decode, not a validation: files are
   * validated on the way in, so a failure here is a hand edit gone wrong.
   */
  decode: (raw: unknown) => T;
}

const FILE_EXTENSION = '.json';
const SLUG_MAX_LENGTH = 60;
const ID_SUFFIX_LENGTH = 12;

/**
 * One directory of `<slug>-<id-suffix>.json` files, one file per entity.
 *
 * - A file is graph content if and only if it ends in `.json`; anything else
 *   in the directory (notes, temp files mid-write) is ignored.
 * - Writes are whole-file and atomic: the content lands in a sibling temp
 *   name, then a rename replaces the target. Two processes writing the same
 *   entity resolve to whichever renamed last — no locks, no preconditions
 *   (decision 68, point 9).
 * - Renaming an entity moves its file: the new slug is written, the old path
 *   removed.
 */
export class FileRepository<T extends object> {
  readonly dir: string;
  private readonly idKey: string;
  private readonly slugOf: (entity: T) => string;
  private readonly decode: (raw: unknown) => T;

  constructor(options: FileRepositoryOptions<T>) {
    this.dir = options.dir;
    this.idKey = options.idKey ?? 'id';
    this.slugOf = options.slugOf;
    this.decode = options.decode;
  }

  /** The entity's id, read through `idKey`. */
  idOf(entity: T): string {
    const id = idOf(entity, this.idKey);
    if (id === null) {
      throw new Error(`Entity has no string "${this.idKey}" field.`);
    }
    return id;
  }

  async write(entity: T): Promise<StoredFile<T>> {
    await mkdir(this.dir, { recursive: true });
    const id = this.idOf(entity);
    const previous = await this.locate(id);
    const target = join(this.dir, fileNameFor(id, this.slugOf(entity)));
    await writeAtomically(target, `${JSON.stringify(entity, null, 2)}\n`);
    if (previous !== null && previous.path !== target) {
      await rm(previous.path, { force: true });
    }
    const stored = await this.read(id);
    if (stored === null) {
      throw new Error(`Wrote ${target} but could not read it back.`);
    }
    return stored;
  }

  async read(id: string): Promise<StoredFile<T> | null> {
    const located = await this.locate(id);
    return located === null ? null : this.load(located.path, located.raw);
  }

  /** Every entity in the directory, in no particular order. */
  async list(): Promise<StoredFile<T>[]> {
    const stored: StoredFile<T>[] = [];
    for (const path of await this.jsonFiles()) {
      const raw = await readRaw(path);
      if (raw === null) continue;
      try {
        stored.push(await this.load(path, raw));
      } catch (error) {
        log.warn('skipping {path}: {error}', { path, error: String(error) });
      }
    }
    return stored;
  }

  async remove(id: string): Promise<boolean> {
    const located = await this.locate(id);
    if (located === null) return false;
    await rm(located.path, { force: true });
    return true;
  }

  /** Whether a reference still points at the bytes it was made against. */
  async check(ref: FileRef): Promise<FileRefStatus> {
    const stored = await this.read(ref.id);
    if (stored === null) return 'missing';
    return stored.hash === ref.hash ? 'fresh' : 'stale';
  }

  private async load(path: string, raw: RawFile): Promise<StoredFile<T>> {
    const [entity, info] = [this.decode(raw.json), await stat(path)];
    return {
      entity,
      path,
      hash: sha256(raw.bytes),
      updatedAt: info.mtime.toISOString(),
    };
  }

  /**
   * The file that holds `id`, found by suffix and confirmed by content — the
   * suffix keeps the scan cheap, the `id` field keeps it exact.
   */
  private async locate(
    id: string,
  ): Promise<{ path: string; raw: RawFile } | null> {
    const suffix = `-${idSuffix(id)}${FILE_EXTENSION}`;
    for (const path of await this.jsonFiles()) {
      if (!path.endsWith(suffix)) continue;
      const raw = await readRaw(path);
      if (raw !== null && idOf(raw.json, this.idKey) === id) {
        return { path, raw };
      }
    }
    return null;
  }

  private async jsonFiles(): Promise<string[]> {
    let entries: Dirent[];
    try {
      entries = await readdir(this.dir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(FILE_EXTENSION))
      .map((e) => join(this.dir, e.name))
      .sort();
  }
}

interface RawFile {
  bytes: Buffer;
  json: unknown;
}

async function readRaw(path: string): Promise<RawFile | null> {
  const bytes = await readFile(path);
  try {
    return { bytes, json: JSON.parse(bytes.toString('utf8')) };
  } catch (error) {
    log.warn('skipping {path}: not JSON ({error})', {
      path,
      error: String(error),
    });
    return null;
  }
}

function idOf(json: unknown, idKey: string): string | null {
  if (typeof json !== 'object' || json === null) return null;
  const id = (json as Record<string, unknown>)[idKey];
  return typeof id === 'string' ? id : null;
}

async function writeAtomically(target: string, content: string) {
  const temp = `${target}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    await writeFile(temp, content, 'utf8');
    await rename(temp, target);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

export function fileNameFor(id: string, slug: string): string {
  return `${slugify(slug)}-${idSuffix(id)}${FILE_EXTENSION}`;
}

/** The tail of the id that goes into the file name: enough to be unique. */
export function idSuffix(id: string): string {
  const compact = id.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return compact.slice(-ID_SUFFIX_LENGTH) || 'x';
}

/** Kebab-cased and capped, so the name reads in a diff and fits any file system. */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '');
  return slug || 'untitled';
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
