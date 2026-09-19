import { randomBytes } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { lstat, mkdir, opendir, readdir, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import {
  type ChildDefinitions,
  COLLECTION_NAME_PATTERN,
  type CreateNoesisStore,
  DATA_FILE_NAME,
  type DeleteOptions,
  KEY_PATTERN,
  type NestedDefinition,
  type NoesisStore,
  NoesisStoreError,
  type NoesisStoreOf,
  type NoesisStoreOperation,
  type NoesisStoreOptions,
} from './noesis-store';

// Directories, renames and link-aware stats go through `node:fs`: Bun's file
// API leaves them to Node's (https://bun.com/docs/runtime/file-io).

const TEMP_FILE_SUFFIX = '.tmp';

/**
 * The handle is built from a runtime definition tree, so the compiler sees
 * `children(key)` as a plain record; the cast to `NoesisStoreOf` is checked
 * at compile time by the integration spec.
 */
export const createNoesisStore: CreateNoesisStore = <
  S extends z.ZodType,
  C extends ChildDefinitions = Record<never, never>,
>(
  options: NoesisStoreOptions<S, C>,
): NoesisStoreOf<S, C> => {
  if (typeof options.directory !== 'string' || options.directory === '') {
    throw new Error('NoesisStore: `directory` must be a non-empty path.');
  }
  const collection = normalizeCollection(
    { schema: options.schema, children: options.children },
    '<root>',
  );
  const store: unknown = new BunNoesisStore(
    resolve(options.directory),
    collection,
    [],
  );
  return store as NoesisStoreOf<S, C>;
};

class BunNoesisStore implements NoesisStore<
  unknown,
  unknown,
  Record<string, unknown>
> {
  readonly directory: string;
  private readonly collection: Collection;
  /** Root first. */
  private readonly ancestors: readonly string[];

  constructor(
    directory: string,
    collection: Collection,
    ancestors: readonly string[],
  ) {
    this.directory = directory;
    this.collection = collection;
    this.ancestors = ancestors;
  }

  async get(key: string): Promise<unknown> {
    const operation = 'get';
    assertKey(key, operation);
    await this.assertAncestors(operation, key);
    return this.read(key, operation);
  }

  async set(key: string, value: unknown): Promise<void> {
    const operation = 'set';
    assertKey(key, operation);
    await this.assertAncestors(operation, key);
    const location = this.locate(key);
    const content = await encodeObject(
      this.collection.schema,
      value,
      key,
      location,
    );
    await ensureObjectDir(location, operation, key);
    await replaceFileAtomically(location.dataFile, content, operation, key);
  }

  async delete(key: string, options: DeleteOptions = {}): Promise<boolean> {
    const operation = 'delete';
    assertKey(key, operation);
    await this.assertAncestors(operation, key);
    const location = this.locate(key);
    if (!(await objectDirExists(location, operation, key))) return false;
    if (options.recursive !== true) {
      await assertOwnsNothing(location, operation, key);
    }
    try {
      await rm(location.dir, { recursive: true, force: true });
    } catch (cause) {
      throw ioError(operation, key, location.dir, cause);
    }
    return true;
  }

  async *keys(): AsyncIterable<string> {
    const operation = 'keys';
    await this.assertAncestors(operation);
    for await (const entry of directoryEntries(this.directory, operation)) {
      if (!entry.isDirectory() || !KEY_PATTERN.test(entry.name)) continue;
      const info = await lstatOrNull(
        this.locate(entry.name).dataFile,
        operation,
        entry.name,
      );
      if (info?.isFile()) yield entry.name;
    }
  }

  async *values(): AsyncIterable<unknown> {
    const operation = 'values';
    for await (const key of this.keys()) {
      const value = await this.read(key, operation);
      if (value !== null) yield value;
    }
  }

  children(key: string): Record<string, unknown> {
    assertKey(key, 'children');
    const location = this.locate(key);
    const handles: Record<string, BunNoesisStore> = {};
    for (const [name, collection] of this.collection.children) {
      handles[name] = new BunNoesisStore(join(location.dir, name), collection, [
        ...this.ancestors,
        location.dir,
      ]);
    }
    return handles;
  }

  private locate(key: string): ObjectLocation {
    return objectLocation(this.directory, key);
  }

  private async read(
    key: string,
    operation: NoesisStoreOperation,
  ): Promise<unknown> {
    const location = this.locate(key);
    if (!(await objectExists(location, operation, key))) return null;
    const text = await readText(location.dataFile, operation, key);
    if (text === null) return null;
    return decodeObject(this.collection.schema, text, operation, key, location);
  }

  /** A child handle never creates a missing ancestor. */
  private async assertAncestors(
    operation: NoesisStoreOperation,
    key?: string,
  ): Promise<void> {
    for (const dir of this.ancestors) {
      const ancestor = { dir, dataFile: join(dir, DATA_FILE_NAME) };
      if (!(await objectExists(ancestor, operation, key))) {
        throw new NoesisStoreError(
          `Parent object of collection ${this.directory} does not exist.`,
          { code: 'PARENT_NOT_FOUND', operation, key, path: ancestor.dataFile },
        );
      }
    }
  }
}

interface Collection {
  schema: z.ZodType;
  children: ReadonlyMap<string, Collection>;
}

function normalizeCollection(
  definition: NestedDefinition,
  label: string,
): Collection {
  if (!isZodSchema(definition.schema)) {
    throw new Error(`NoesisStore: collection ${label} has no Zod schema.`);
  }
  const children = new Map<string, Collection>();
  const lowerCased = new Set<string>();
  const declared: ChildDefinitions = definition.children ?? {};
  for (const [name, child] of Object.entries(declared)) {
    if (!COLLECTION_NAME_PATTERN.test(name)) {
      throw new Error(
        `NoesisStore: child collection name "${name}" of ${label} is invalid; ` +
          `names match ${COLLECTION_NAME_PATTERN}.`,
      );
    }
    const folded = name.toLowerCase();
    if (lowerCased.has(folded)) {
      throw new Error(
        `NoesisStore: child collection names of ${label} must not differ only by case ("${name}").`,
      );
    }
    lowerCased.add(folded);
    const nested: NestedDefinition = isZodSchema(child)
      ? { schema: child }
      : child;
    if (typeof nested !== 'object' || nested === null) {
      throw new Error(
        `NoesisStore: child collection "${name}" of ${label} must be a schema or a definition.`,
      );
    }
    children.set(name, normalizeCollection(nested, `${label}/${name}`));
  }
  return { schema: definition.schema, children };
}

function isZodSchema(value: unknown): value is z.ZodType {
  return value instanceof z.ZodType;
}

interface ObjectLocation {
  dir: string;
  dataFile: string;
}

function objectLocation(collectionDir: string, key: string): ObjectLocation {
  const dir = join(collectionDir, key);
  return { dir, dataFile: join(dir, DATA_FILE_NAME) };
}

function assertKey(key: string, operation: NoesisStoreOperation): void {
  if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
    throw new NoesisStoreError(
      `Invalid key ${JSON.stringify(key)}; keys match ${KEY_PATTERN}.`,
      { code: 'INVALID_KEY', operation, key: String(key) },
    );
  }
}

function isTemporaryName(name: string): boolean {
  return name.endsWith(TEMP_FILE_SUFFIX);
}

/** A link or file in the way is an error: managed paths never follow links. */
async function objectDirExists(
  location: ObjectLocation,
  operation: NoesisStoreOperation,
  key: string | undefined,
): Promise<boolean> {
  const info = await lstatOrNull(location.dir, operation, key);
  if (info === null) return false;
  if (info.isSymbolicLink()) throw symlinkError(operation, key, location.dir);
  if (!info.isDirectory()) {
    throw ioError(
      operation,
      key,
      location.dir,
      new Error('The object path is not a directory.'),
    );
  }
  return true;
}

async function objectExists(
  location: ObjectLocation,
  operation: NoesisStoreOperation,
  key: string | undefined,
): Promise<boolean> {
  if (!(await objectDirExists(location, operation, key))) return false;
  const info = await lstatOrNull(location.dataFile, operation, key);
  if (info === null) return false;
  if (info.isSymbolicLink()) {
    throw symlinkError(operation, key, location.dataFile);
  }
  if (!info.isFile()) {
    throw ioError(
      operation,
      key,
      location.dataFile,
      new Error('The data file path is not a regular file.'),
    );
  }
  return true;
}

async function ensureObjectDir(
  location: ObjectLocation,
  operation: NoesisStoreOperation,
  key: string,
): Promise<void> {
  if (await objectDirExists(location, operation, key)) return;
  try {
    await mkdir(location.dir, { recursive: true });
  } catch (cause) {
    throw ioError(operation, key, location.dir, cause);
  }
}

/**
 * An object may be deleted without `recursive` when it owns nothing: only
 * `data.json`, temporary files and empty collection directories. Anything
 * else — a child object, a foreign file, a directory the current definition
 * no longer declares — is refused.
 */
async function assertOwnsNothing(
  location: ObjectLocation,
  operation: NoesisStoreOperation,
  key: string,
): Promise<void> {
  for await (const entry of directoryEntries(location.dir, operation, key)) {
    const path = join(location.dir, entry.name);
    if (entry.isFile()) {
      if (entry.name === DATA_FILE_NAME || isTemporaryName(entry.name)) {
        continue;
      }
      throw notEmpty(operation, key, path, `holds a file "${entry.name}"`);
    }
    if (!entry.isDirectory()) {
      throw notEmpty(operation, key, path, `holds "${entry.name}"`);
    }
    let inside: string[];
    try {
      inside = await readdir(path);
    } catch (cause) {
      throw ioError(operation, key, path, cause);
    }
    if (inside.length > 0) {
      throw notEmpty(
        operation,
        key,
        path,
        `still owns objects in "${entry.name}"`,
      );
    }
  }
}

/** Streams entries so a consumer that stops early never pays for the rest. */
async function* directoryEntries(
  path: string,
  operation: NoesisStoreOperation,
  key?: string,
): AsyncIterable<Dirent> {
  let dir: Awaited<ReturnType<typeof opendir>>;
  try {
    dir = await opendir(path);
  } catch (cause) {
    if (isErrno(cause, 'ENOENT')) return;
    throw ioError(operation, key, path, cause);
  }
  try {
    for (
      let entry = await dir.read();
      entry !== null;
      entry = await dir.read()
    ) {
      yield entry;
    }
  } catch (cause) {
    throw ioError(operation, key, path, cause);
  } finally {
    await dir.close().catch(() => undefined);
  }
}

async function lstatOrNull(
  path: string,
  operation: NoesisStoreOperation,
  key: string | undefined,
) {
  try {
    return await lstat(path);
  } catch (cause) {
    if (isErrno(cause, 'ENOENT') || isErrno(cause, 'ENOTDIR')) return null;
    throw ioError(operation, key, path, cause);
  }
}

/** `null` when the file vanished after the existence check. */
async function readText(
  path: string,
  operation: NoesisStoreOperation,
  key: string,
): Promise<string | null> {
  try {
    return await Bun.file(path).text();
  } catch (cause) {
    if (isErrno(cause, 'ENOENT')) return null;
    throw ioError(operation, key, path, cause);
  }
}

/** Temp file plus rename, so a reader never sees a partial write. */
async function replaceFileAtomically(
  path: string,
  content: string,
  operation: NoesisStoreOperation,
  key: string,
): Promise<void> {
  const temp = `${path}.${randomBytes(6).toString('hex')}${TEMP_FILE_SUFFIX}`;
  try {
    await Bun.write(temp, content);
    await rename(temp, path);
  } catch (cause) {
    await Bun.file(temp)
      .delete()
      .catch(() => undefined);
    throw ioError(operation, key, path, cause);
  }
}

async function validate(
  schema: z.ZodType,
  value: unknown,
  operation: NoesisStoreOperation,
  key: string,
  location: ObjectLocation,
): Promise<unknown> {
  try {
    return await schema.parseAsync(value);
  } catch (cause) {
    const where = operation === 'set' ? 'supplied' : 'on disk';
    throw new NoesisStoreError(
      `Object "${key}" ${where} does not match the collection schema.`,
      {
        code: 'VALIDATION_FAILED',
        operation,
        key,
        path: location.dataFile,
        cause,
      },
    );
  }
}

async function decodeObject(
  schema: z.ZodType,
  text: string,
  operation: NoesisStoreOperation,
  key: string,
  location: ObjectLocation,
): Promise<unknown> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (cause) {
    throw new NoesisStoreError(`Object "${key}" is not valid JSON.`, {
      code: 'INVALID_JSON',
      operation,
      key,
      path: location.dataFile,
      cause,
    });
  }
  return validate(schema, json, operation, key, location);
}

async function encodeObject(
  schema: z.ZodType,
  value: unknown,
  key: string,
  location: ObjectLocation,
): Promise<string> {
  const parsed = await validate(schema, value, 'set', key, location);
  return serializeObject(parsed, key, location);
}

/**
 * Anything `JSON.stringify` would drop or rewrite (`Date`, `BigInt`, `Map`,
 * `NaN`, array holes, cycles) is refused rather than silently changed. An
 * `undefined` property is an omitted optional property.
 */
function serializeObject(
  value: unknown,
  key: string,
  location: ObjectLocation,
): string {
  const refuse = (what: string, cause?: unknown): NoesisStoreError =>
    new NoesisStoreError(`Object "${key}" cannot be stored as JSON: ${what}.`, {
      code: 'UNSUPPORTED_VALUE',
      operation: 'set',
      key,
      path: location.dataFile,
      cause,
    });
  const unrepresentable = findUnrepresentable(value);
  if (unrepresentable !== null) {
    throw refuse(`${unrepresentable.what} at ${unrepresentable.at}`);
  }
  try {
    return `${JSON.stringify(value, null, 2)}\n`;
  } catch (cause) {
    throw refuse('serialization failed', cause);
  }
}

function findUnrepresentable(
  value: unknown,
): { at: string; what: string } | null {
  if (!isPlainObject(value)) {
    return { at: '$', what: 'the object is not a plain object' };
  }
  const stack: object[] = [];
  const visit = (
    node: unknown,
    at: string,
  ): { at: string; what: string } | null => {
    switch (typeof node) {
      case 'string':
      case 'boolean':
        return null;
      case 'number':
        return Number.isFinite(node)
          ? null
          : { at, what: 'a non-finite number' };
      case 'object':
        break;
      default:
        return { at, what: `a value of type ${typeof node}` };
    }
    if (node === null) return null;
    if (stack.includes(node)) return { at, what: 'a circular reference' };
    stack.push(node);
    try {
      if (Array.isArray(node)) {
        for (let index = 0; index < node.length; index++) {
          const here = `${at}[${index}]`;
          if (!(index in node)) return { at: here, what: 'a hole in an array' };
          const found = visit(node[index], here);
          if (found !== null) return found;
        }
        return null;
      }
      if (!isPlainObject(node)) {
        return { at, what: `a ${describe(node)}, not a plain object` };
      }
      for (const [name, child] of Object.entries(node)) {
        if (child === undefined) continue;
        const found = visit(child, `${at}.${name}`);
        if (found !== null) return found;
      }
      return null;
    } finally {
      stack.pop();
    }
  };
  return visit(value, '$');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function describe(value: object): string {
  const name = value.constructor?.name;
  return typeof name === 'string' && name !== '' ? name : 'non-plain object';
}

function isErrno(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

function ioError(
  operation: NoesisStoreOperation,
  key: string | undefined,
  path: string,
  cause: unknown,
): NoesisStoreError {
  const reason = cause instanceof Error ? cause.message : String(cause);
  return new NoesisStoreError(`${operation} failed at ${path}: ${reason}`, {
    code: 'IO_ERROR',
    operation,
    key,
    path,
    cause,
  });
}

function symlinkError(
  operation: NoesisStoreOperation,
  key: string | undefined,
  path: string,
): NoesisStoreError {
  return ioError(
    operation,
    key,
    path,
    new Error('Managed paths must not be symbolic links.'),
  );
}

function notEmpty(
  operation: NoesisStoreOperation,
  key: string,
  path: string,
  what: string,
): NoesisStoreError {
  return new NoesisStoreError(
    `Object "${key}" ${what}; pass { recursive: true } to remove it with everything it owns.`,
    { code: 'NOT_EMPTY', operation, key, path },
  );
}
