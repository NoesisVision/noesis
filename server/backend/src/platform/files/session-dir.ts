import type { Dirent } from 'node:fs';
import { mkdir, readdir, realpath, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { err, ok, type Result } from 'neverthrow';
import { v7 as uuidv7 } from 'uuid';
import { serverLogger } from '#backend/platform/logging/logging';
import type { NoesisDir } from './noesis-dir';

const log = serverLogger('session');

declare const workingFilePathBrand: unique symbol;
/** Checked by `resolveWorkingPath`: real, and under `.noesis/sessions/`. */
export type WorkingFilePath = string & {
  readonly [workingFilePathBrand]: true;
};

const SESSIONS_DIR_NAME = 'sessions';
/** Scratch left by a session that never shut down cleanly is swept after this. */
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionDirOptions {
  id?: string;
  now?: () => number;
  maxAgeMs?: number;
}

/**
 * MCP messages carry paths into this scratch area, not content.
 * The watcher ignores `sessions/`, so nothing written here reaches the graph.
 */
export class SessionDir {
  readonly id: string;
  readonly path: string;
  readonly sessionsRoot: string;
  private readonly repositoryRoot: string;
  private readonly now: () => number;
  private readonly maxAgeMs: number;

  constructor(
    noesis: NoesisDir,
    repositoryRoot: string,
    options: SessionDirOptions = {},
  ) {
    this.repositoryRoot = repositoryRoot;
    this.id = options.id ?? uuidv7();
    this.sessionsRoot = noesis.resolve(SESSIONS_DIR_NAME);
    this.path = join(this.sessionsRoot, this.id);
    this.now = options.now ?? Date.now;
    this.maxAgeMs = options.maxAgeMs ?? SESSION_MAX_AGE_MS;
  }

  async open(): Promise<void> {
    await mkdir(this.path, { recursive: true });
    await this.removeStaleSessionDirs();
  }

  async dispose(): Promise<void> {
    await rm(this.path, { recursive: true, force: true });
  }

  /**
   * Any session's directory is accepted: skills may write under `sessions/`
   * without knowing the id. Relative paths resolve against the repository
   * root, where the agent's own tools run. Symlinks are followed before the
   * check, so a link out of `sessions/` is refused too — and both spellings of
   * `sessions/` count, the configured one and the one it resolves to, because an
   * agent that resolves paths itself passes the latter.
   */
  async resolveWorkingPath(
    input: string,
  ): Promise<Result<WorkingFilePath, string>> {
    const absolute = this.toAbsolute(input);
    const realSessionsRoot = await realpathIfExists(this.sessionsRoot);
    if (!this.isUnderSessionsRoot(absolute, realSessionsRoot)) {
      return this.notUnderSessions(input);
    }
    const target = await realpathIfExists(absolute);
    if (target === null) return noFileAt(absolute);
    if (realSessionsRoot === null || !isInside(realSessionsRoot, target)) {
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

  private isUnderSessionsRoot(
    absolute: string,
    realSessionsRoot: string | null,
  ): boolean {
    return (
      isInside(this.sessionsRoot, absolute) ||
      (realSessionsRoot !== null && isInside(realSessionsRoot, absolute))
    );
  }

  private notUnderSessions(input: string): Result<never, string> {
    return err(
      `${input} is not under ${relative(this.repositoryRoot, this.sessionsRoot)}/. Tools accept only paths under .noesis/sessions/; this session's directory is ${this.path}.`,
    );
  }

  private async removeStaleSessionDirs(): Promise<void> {
    const cutoff = this.now() - this.maxAgeMs;
    let removed = 0;
    for (const dir of await this.listOtherSessionDirs()) {
      if (await this.removeIfStale(dir, cutoff)) removed += 1;
    }
    if (removed > 0) {
      log.info('swept {swept} stale session dir(s)', { swept: removed });
    }
  }

  private async listOtherSessionDirs(): Promise<string[]> {
    let entries: Dirent[];
    try {
      entries = await readdir(this.sessionsRoot, { withFileTypes: true });
    } catch (error) {
      log.warn('could not list {dir}: {error}', {
        dir: this.sessionsRoot,
        error: String(error),
      });
      return [];
    }
    return entries
      .filter((entry) => entry.isDirectory() && entry.name !== this.id)
      .map((entry) => join(this.sessionsRoot, entry.name));
  }

  /** A crashed session's leftovers are never worth failing a boot over. */
  private async removeIfStale(dir: string, cutoff: number): Promise<boolean> {
    try {
      if ((await stat(dir)).mtimeMs > cutoff) return false;
      await rm(dir, { recursive: true, force: true });
      return true;
    } catch (error) {
      log.warn('could not sweep {dir}: {error}', {
        dir,
        error: String(error),
      });
      return false;
    }
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
