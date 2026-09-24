import { err, ok, type Result, ResultAsync } from 'neverthrow';
import type { ZodType } from 'zod';
import { readJsonFile } from '#backend/platform/files/json-file';
import type {
  SessionDir,
  WorkingFilePath,
} from '#backend/platform/files/session-dir';

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
export function readWorkingFile<T>(
  session: SessionDir,
  schema: ZodType<T>,
  path: string,
): ResultAsync<T, string> {
  return new ResultAsync(session.resolveWorkingPath(path))
    .mapErr(
      (message) =>
        `${message} Write the file under ${session.path} and pass that path.`,
    )
    .andThen(withinSizeLimit)
    .andThen((checked) => new ResultAsync(readJsonFile(checked, schema)));
}

function withinSizeLimit(
  path: WorkingFilePath,
): Result<WorkingFilePath, string> {
  const size = Bun.file(path).size;
  return size > MAX_WORKING_FILE_BYTES
    ? err(
        `${path} is ${size} bytes; a working file is at most ${MAX_WORKING_FILE_BYTES}. Pass the path of the document you wrote, or split it into documents of their own.`,
      )
    : ok(path);
}
