import { err, ok, type Result, ResultAsync } from 'neverthrow';
import type { ZodType } from 'zod';
import {
  type ValidationFailure,
  validate,
  wholeFileIssue,
} from '#backend/app/validation/validator';
import type { SessionDir } from '#backend/platform/files/session-dir';

/**
 * A working file is one document the agent just wrote, so anything this large
 * is the wrong path — an index, a log, a dump. Reading it would pull the whole
 * file into memory before the shape is known.
 */
export const MAX_WORKING_FILE_BYTES = 4 * 1024 * 1024;

/**
 * An MCP message carries a path into `.noesis/tmp/<session>/`,
 * never the payload itself, and the payload is checked once — here, before
 * any service sees it.
 */
export function readWorkingFile<T>(
  session: SessionDir,
  schema: ZodType<T>,
  path: string,
): ResultAsync<T, ValidationFailure> {
  return new ResultAsync(session.resolveWorkingPath(path))
    .mapErr(
      (message) =>
        `${message} Write the file under ${session.path} and pass that path.`,
    )
    .andThen(withinSizeLimit)
    .andThen(readJson)
    .mapErr(wholeFileIssue)
    .andThen((json) => validate(schema, json));
}

function withinSizeLimit(path: string): Result<string, string> {
  const size = Bun.file(path).size;
  return size > MAX_WORKING_FILE_BYTES
    ? err(
        `${path} is ${size} bytes; a working file is at most ${MAX_WORKING_FILE_BYTES}. Pass the path of the document you wrote, or split it into documents of their own.`,
      )
    : ok(path);
}

function readJson(path: string): ResultAsync<unknown, string> {
  return ResultAsync.fromPromise(
    Bun.file(path).json(),
    (error) =>
      `Unreadable JSON — ${String(error)}. Rewrite the file as JSON, then call the tool again.`,
  );
}
