import { randomBytes } from 'node:crypto';
import { mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { err, ok, type Result } from 'neverthrow';
import { z, type ZodType } from 'zod';

/** One mistake repeated across a large array must not bury the first real cause. */
const ISSUE_CAP = 20;

/** Unreadable file, broken JSON or schema failure, as one message. */
export async function readJsonFile<T>(
  path: string,
  schema: ZodType<T>,
): Promise<Result<T, string>> {
  let json: unknown;
  try {
    json = JSON.parse(await Bun.file(path).text());
  } catch (error) {
    return err(`Unreadable JSON: ${String(error)}`);
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? ok(parsed.data) : err(describeIssues(parsed.error));
}

/**
 * Validates, encodes, writes `path.<random>.tmp` and renames it over `path`,
 * so a reader never sees a half-written file. Creates the parent directory.
 */
export async function writeJsonFile<T>(
  path: string,
  schema: ZodType<T>,
  value: T,
): Promise<void> {
  // A schema may decode into a value object (a codec); what is stored is the
  // JSON side of it, which a read decodes again.
  const encoded = schema.safeEncode(value);
  if (!encoded.success) {
    throw new JsonFileError(path, describeIssues(encoded.error));
  }
  await mkdir(dirname(path), { recursive: true });
  await replaceAtomically(path, `${JSON.stringify(encoded.data, null, 2)}\n`);
}

export class JsonFileError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'JsonFileError';
    this.path = path;
  }
}

function describeIssues(error: z.ZodError): string {
  const shown = new z.ZodError(error.issues.slice(0, ISSUE_CAP));
  const more = error.issues.length - ISSUE_CAP;
  return z.prettifyError(shown) + (more > 0 ? `\n… and ${more} more` : '');
}

async function replaceAtomically(path: string, content: string): Promise<void> {
  const temp = `${path}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    await Bun.write(temp, content);
    await rename(temp, path);
  } catch (error) {
    await Bun.file(temp)
      .delete()
      .catch(() => undefined);
    throw error;
  }
}
