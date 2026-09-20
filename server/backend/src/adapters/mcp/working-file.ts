import {
  type FileContract,
  singleIssue,
  type ValidationReport,
  validate,
} from '#backend/app/validation/validator';
import type { SessionDir } from '#backend/platform/files/session-dir';

/**
 * A working file is one document the agent just wrote, so anything this large
 * is the wrong path — an index, a log, a dump. Reading it would pull the whole
 * file into memory before the shape is known.
 */
export const MAX_WORKING_FILE_BYTES = 4 * 1024 * 1024;

/**
 * Decision D3: an MCP message carries a path into `.noesis/tmp/<session>/`,
 * never the payload itself, and the payload is checked once — here, before
 * any service sees it.
 */
export async function readWorkingFile<T>(
  session: SessionDir,
  contract: FileContract<T>,
  path: string,
): Promise<ValidationReport<T>> {
  const resolved = await session.resolveWorkingPath(path);
  if (!resolved.ok) {
    return singleIssue({
      path: '$',
      expected: 'a path to a working file under .noesis/tmp/',
      found: resolved.message,
      fix: `Write the file under ${session.path} and pass that path`,
    });
  }
  const size = Bun.file(resolved.path).size;
  if (size > MAX_WORKING_FILE_BYTES) {
    return singleIssue({
      path: '$',
      expected: `a working file of at most ${MAX_WORKING_FILE_BYTES} bytes`,
      found: `${size} bytes at ${resolved.path}`,
      fix: 'Pass the path of the document you wrote, or split it into documents of their own',
    });
  }
  const json = await readJson(resolved.path);
  if (!json.ok) {
    return singleIssue({
      path: '$',
      expected: 'a JSON file',
      found: json.message,
      fix: 'Rewrite the file as JSON, then call the tool again',
    });
  }
  return validate(contract, json.value);
}

type JsonResult = { ok: true; value: unknown } | { ok: false; message: string };

/** The only throwing call in the flow, confined so the rest reads as steps. */
async function readJson(path: string): Promise<JsonResult> {
  try {
    return { ok: true, value: await Bun.file(path).json() };
  } catch (error) {
    return { ok: false, message: `unreadable JSON — ${String(error)}` };
  }
}
