import { randomBytes } from 'node:crypto';
import {
  linkSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z, type ZodType } from 'zod';

/** One mistake repeated across a large array must not bury the first real cause. */
const ISSUE_CAP = 20;

/** A file that cannot be read as `schema`: its path, and what is wrong with it. */
export class JsonFileError extends Error {
  readonly path: string;
  /** What is wrong, without the path: one message, the issues capped. */
  readonly reason: string;

  constructor(path: string, reason: string) {
    super(`${path}: ${reason}`);
    this.name = 'JsonFileError';
    this.path = path;
    this.reason = reason;
  }
}

/** Throws `JsonFileError` for broken JSON or a schema failure. */
export function decodeJson<T>(
  path: string,
  text: string,
  schema: ZodType<T>,
): T {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new JsonFileError(path, `Unreadable JSON: ${String(error)}`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new JsonFileError(path, describeIssues(parsed.error));
  }
  return parsed.data;
}

/** Throws `JsonFileError` for an unreadable file, broken JSON or a schema failure. */
export async function readJsonFile<T>(
  path: string,
  schema: ZodType<T>,
): Promise<T> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    throw new JsonFileError(path, `Unreadable file: ${String(error)}`);
  }
  return decodeJson(path, text, schema);
}

/**
 * Validates, encodes, writes `path.<random>.tmp` and renames it over `path`,
 * so a reader never sees a half-written file. Creates the parent directory.
 * Synchronous, so a check made just before it cannot be interleaved.
 */
export function writeJsonFile<T>(
  path: string,
  schema: ZodType<T>,
  value: T,
): void {
  const content = encodeJson(path, schema, value);
  mkdirSync(dirname(path), { recursive: true });
  replaceAtomically(path, content);
}

/**
 * As `writeJsonFile`, but only where no file is: answers `false`, writing
 * nothing, when one exists. The temp file is hard-linked to `path`, which the
 * filesystem refuses atomically when the name is taken — so two processes
 * creating the same entity cannot both succeed.
 */
export function createJsonFile<T>(
  path: string,
  schema: ZodType<T>,
  value: T,
): boolean {
  const content = encodeJson(path, schema, value);
  mkdirSync(dirname(path), { recursive: true });
  return createAtomically(path, content);
}

// A schema may decode into a value object (a codec); what is stored is the
// JSON side of it, which a read decodes again.
function encodeJson<T>(path: string, schema: ZodType<T>, value: T): string {
  const encoded = schema.safeEncode(value);
  if (!encoded.success) {
    throw new JsonFileError(path, describeIssues(encoded.error));
  }
  return `${JSON.stringify(encoded.data, null, 2)}\n`;
}

function describeIssues(error: z.ZodError): string {
  const shown = new z.ZodError(error.issues.slice(0, ISSUE_CAP));
  const more = error.issues.length - ISSUE_CAP;
  return z.prettifyError(shown) + (more > 0 ? `\n… and ${more} more` : '');
}

function replaceAtomically(path: string, content: string): void {
  const temp = tempPathBeside(path);
  try {
    writeFileSync(temp, content);
    renameSync(temp, path);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
}

function createAtomically(path: string, content: string): boolean {
  const temp = tempPathBeside(path);
  try {
    writeFileSync(temp, content);
    linkSync(temp, path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  } finally {
    rmSync(temp, { force: true });
  }
}

function tempPathBeside(path: string): string {
  return `${path}.${randomBytes(6).toString('hex')}.tmp`;
}
