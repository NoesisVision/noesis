import type { Dirent } from 'node:fs';
import {
  mkdir,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import { serverLogger } from '#backend/platform/logging/logging';
import type { NoesisDir } from './noesis-dir';

const log = serverLogger('session');

const TMP_DIR_NAME = 'tmp';
/** Scratch left by a session that never shut down cleanly is swept after this. */
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const INLINE_RESULT_LIMIT = 8 * 1024;

export interface SessionDirOptions {
  id?: string;
  now?: () => number;
  maxAgeMs?: number;
  inlineResultLimit?: number;
}

export type WorkingPathResult =
  | { ok: true; path: string }
  | { ok: false; message: string };

/**
 * Decision D2: MCP messages carry paths into this scratch area, not content.
 * The watcher ignores `tmp/`, so nothing written here reaches the graph.
 */
export class SessionDir {
  readonly id: string;
  readonly path: string;
  readonly tmpRoot: string;
  private readonly repositoryRoot: string;
  private readonly now: () => number;
  private readonly maxAgeMs: number;
  private readonly inlineResultLimit: number;
  private results = 0;

  constructor(
    noesis: NoesisDir,
    repositoryRoot: string,
    options: SessionDirOptions = {},
  ) {
    this.repositoryRoot = repositoryRoot;
    this.id = options.id ?? uuidv7();
    this.tmpRoot = noesis.resolve(TMP_DIR_NAME);
    this.path = join(this.tmpRoot, this.id);
    this.now = options.now ?? Date.now;
    this.maxAgeMs = options.maxAgeMs ?? SESSION_MAX_AGE_MS;
    this.inlineResultLimit = options.inlineResultLimit ?? INLINE_RESULT_LIMIT;
  }

  async open(): Promise<void> {
    await mkdir(this.path, { recursive: true });
    await this.removeStaleSessionDirs();
  }

  async dispose(): Promise<void> {
    await rm(this.path, { recursive: true, force: true });
  }

  /**
   * Any session's directory is accepted: skills may write under `tmp/`
   * without knowing the id. Relative paths resolve against the repository
   * root, where the agent's own tools run. Symlinks are followed before the
   * check, so a link out of `tmp/` is refused too.
   */
  async resolveWorkingPath(input: string): Promise<WorkingPathResult> {
    const absolute = this.toAbsolute(input);
    if (!isInside(this.tmpRoot, absolute)) return this.notUnderTmp(input);
    const target = await realpathIfExists(absolute);
    if (target === null) return noFileAt(absolute);
    if (!(await this.isInsideRealTmpRoot(target))) {
      return this.notUnderTmp(input);
    }
    return { ok: true, path: absolute };
  }

  async deliver(text: string): Promise<string> {
    const bytes = Buffer.byteLength(text);
    if (this.fitsInline(bytes)) return text;
    const file = await this.writeResultFile(text);
    return this.readFromFileInstruction(file, bytes);
  }

  private toAbsolute(input: string): string {
    return isAbsolute(input)
      ? normalize(input)
      : resolve(this.repositoryRoot, input);
  }

  private async isInsideRealTmpRoot(target: string): Promise<boolean> {
    return isInside(await realpath(this.tmpRoot), target);
  }

  private notUnderTmp(input: string): WorkingPathResult {
    return {
      ok: false,
      message: `${input} is not under ${relative(this.repositoryRoot, this.tmpRoot)}/. Tools accept only paths under .noesis/tmp/; this session's directory is ${this.path}.`,
    };
  }

  private fitsInline(bytes: number): boolean {
    return bytes <= this.inlineResultLimit;
  }

  private async writeResultFile(text: string): Promise<string> {
    this.results += 1;
    const file = join(this.path, `result-${this.results}.txt`);
    await writeFile(file, text);
    return file;
  }

  private readFromFileInstruction(file: string, bytes: number): string {
    return `The result is ${bytes} bytes, above the ${this.inlineResultLimit}-byte inline limit, and was written to ${file}. Read it from there.`;
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
      entries = await readdir(this.tmpRoot, { withFileTypes: true });
    } catch (error) {
      log.warn('could not list {dir}: {error}', {
        dir: this.tmpRoot,
        error: String(error),
      });
      return [];
    }
    return entries
      .filter((entry) => entry.isDirectory() && entry.name !== this.id)
      .map((entry) => join(this.tmpRoot, entry.name));
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
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

async function realpathIfExists(path: string): Promise<string | null> {
  try {
    return await realpath(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function noFileAt(path: string): WorkingPathResult {
  return { ok: false, message: `No file at ${path}.` };
}
