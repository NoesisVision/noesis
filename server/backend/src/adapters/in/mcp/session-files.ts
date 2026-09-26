import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, normalize, relative, resolve, sep } from 'node:path';
import type { ZodType } from 'zod';
import { JsonFileError, readJsonFile } from '#backend/platform/files/json-file';
import { WorkingFileError } from './working-file-error';

declare const workingFilePathBrand: unique symbol;
/** Checked by `resolve`: real, and under `.noesis/sessions/`. */
export type WorkingFilePath = string & {
  readonly [workingFilePathBrand]: true;
};

/**
 * A working file is one document the agent just wrote, so anything this large
 * is the wrong path — an index, a log, a dump. Reading it would pull the whole
 * file into memory before the shape is known.
 */
export const MAX_WORKING_FILE_BYTES = 4 * 1024 * 1024;

export interface SessionFilesLocation {
  repositoryRoot: string;
  /** `.noesis/sessions/` as configured. */
  sessionsRoot: string;
  /** The same directory with symlinks resolved; it must exist. */
  realSessionsRoot: string;
  /** This session's directory, named to the agent as where to write. */
  dir: string;
}

/**
 * MCP messages carry paths into `.noesis/sessions/`, not content. This is
 * what the tools see of the session: where to write, and how a written file
 * is read back. Every refusal is a `WorkingFileError` naming `subject`, the
 * thing the file was meant to hold, which `logged` answers in-band.
 */
export class SessionFiles {
  readonly dir: string;
  readonly sessionsRoot: string;
  private readonly repositoryRoot: string;
  private readonly realSessionsRoot: string;

  constructor(location: SessionFilesLocation) {
    this.dir = location.dir;
    this.sessionsRoot = location.sessionsRoot;
    this.repositoryRoot = location.repositoryRoot;
    this.realSessionsRoot = location.realSessionsRoot;
  }

  /** The payload is checked once — here, before any service sees it. */
  async read<T>(subject: string, schema: ZodType<T>, path: string): Promise<T> {
    const resolved = await this.resolve(subject, path);
    const { size } = await stat(resolved);
    if (size > MAX_WORKING_FILE_BYTES) {
      throw new WorkingFileError(
        subject,
        `${resolved} is ${size} bytes; a working file is at most ${MAX_WORKING_FILE_BYTES}. Pass the path of the document you wrote, or split it into documents of their own.`,
      );
    }
    return decodeWorkingFile(subject, resolved, schema);
  }

  /**
   * Any session's directory is accepted: skills may write under `sessions/`
   * without knowing the id. Relative paths resolve against the repository
   * root, where the agent's own tools run. The check runs on the path with
   * symlinks resolved, so a link out of `sessions/` is refused and a
   * symlinked repository root is accepted under either spelling.
   */
  async resolve(subject: string, input: string): Promise<WorkingFilePath> {
    const absolute = this.toAbsolute(input);
    const target = await realpathIfExists(absolute);
    if (target === null) {
      throw new WorkingFileError(
        subject,
        `No file at ${absolute}. Write the file under ${this.dir} and pass that path.`,
      );
    }
    if (!isInside(this.realSessionsRoot, target)) {
      throw new WorkingFileError(
        subject,
        `${input} is not under ${relative(this.repositoryRoot, this.sessionsRoot)}/. Tools accept only paths under .noesis/sessions/; this session's directory is ${this.dir}.`,
      );
    }
    // The checked path, not the spelled one: a link swapped in after the check
    // would otherwise be read in its place.
    return target as WorkingFilePath;
  }

  private toAbsolute(input: string): string {
    return isAbsolute(input)
      ? normalize(input)
      : resolve(this.repositoryRoot, input);
  }
}

/** A file that does not fit is the agent's mistake, told as one. */
async function decodeWorkingFile<T>(
  subject: string,
  path: WorkingFilePath,
  schema: ZodType<T>,
): Promise<T> {
  try {
    return await readJsonFile(path, schema);
  } catch (error) {
    if (error instanceof JsonFileError) {
      throw new WorkingFileError(subject, error.reason);
    }
    throw error;
  }
}

/** Strictly below: the parent itself does not count. */
function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  if (rel === '' || isAbsolute(rel)) return false;
  // `..` as a whole segment climbs out; a name that merely starts with dots does not.
  return rel !== '..' && !rel.startsWith(`..${sep}`);
}

async function realpathIfExists(path: string): Promise<string | null> {
  try {
    return await realpath(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
