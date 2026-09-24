import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, normalize, relative, resolve, sep } from 'node:path';
import { err, ok, type Result } from 'neverthrow';
import type { ZodType } from 'zod';
import { readJsonFile } from '#backend/platform/files/json-file';

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
 * is read back.
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
  async read<T>(schema: ZodType<T>, path: string): Promise<Result<T, string>> {
    const resolved = await this.resolve(path);
    if (resolved.isErr()) {
      return err(
        `${resolved.error} Write the file under ${this.dir} and pass that path.`,
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

  /**
   * Any session's directory is accepted: skills may write under `sessions/`
   * without knowing the id. Relative paths resolve against the repository
   * root, where the agent's own tools run. The check runs on the path with
   * symlinks resolved, so a link out of `sessions/` is refused and a
   * symlinked repository root is accepted under either spelling.
   */
  async resolve(input: string): Promise<Result<WorkingFilePath, string>> {
    const absolute = this.toAbsolute(input);
    const target = await realpathIfExists(absolute);
    if (target === null) return noFileAt(absolute);
    if (!isInside(this.realSessionsRoot, target)) {
      return this.notUnderSessions(input);
    }
    // The checked path, not the spelled one: a link swapped in after the check
    // would otherwise be read in its place.
    return ok(target as WorkingFilePath);
  }

  private toAbsolute(input: string): string {
    return isAbsolute(input)
      ? normalize(input)
      : resolve(this.repositoryRoot, input);
  }

  private notUnderSessions(input: string): Result<never, string> {
    return err(
      `${input} is not under ${relative(this.repositoryRoot, this.sessionsRoot)}/. Tools accept only paths under .noesis/sessions/; this session's directory is ${this.dir}.`,
    );
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

function noFileAt(path: string): Result<never, string> {
  return err(`No file at ${path}.`);
}
