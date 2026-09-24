import { stat } from 'node:fs/promises';
import { err, type Result } from 'neverthrow';
import type { ZodType } from 'zod';
import { readJsonFile } from '#backend/platform/files/json-file';
import type { SessionDir } from '#backend/platform/files/session-dir';

/**
 * A working file is one document the agent just wrote, so anything this large
 * is the wrong path — an index, a log, a dump. Reading it would pull the whole
 * file into memory before the shape is known.
 */
export const MAX_WORKING_FILE_BYTES = 4 * 1024 * 1024;

/**
 * An MCP message carries a path into `.noesis/sessions/<session>/`,
 * never the payload itself, and the payload is checked once — here, before
 * any service sees it.
 */
export async function readWorkingFile<T>(
  session: SessionDir,
  schema: ZodType<T>,
  path: string,
): Promise<Result<T, string>> {
  const resolved = await session.resolveWorkingPath(path);
  if (resolved.isErr()) {
    return err(
      `${resolved.error} Write the file under ${session.path} and pass that path.`,
    );
  }
  const { size } = await stat(resolved.value);
  if (size > MAX_WORKING_FILE_BYTES) {
    return err(
      `${resolved.value} is ${size} bytes; a working file is at most ${MAX_WORKING_FILE_BYTES}. Pass the path of the document you wrote, or split it into documents of their own.`,
    );
  }
  return readJsonFile(resolved.value, schema);
}
