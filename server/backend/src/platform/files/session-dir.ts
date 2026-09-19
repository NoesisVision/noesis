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
  private readonly noesis: NoesisDir;
  private readonly now: () => number;
  private readonly maxAgeMs: number;
  private readonly inlineResultLimit: number;
  private results = 0;

  constructor(noesis: NoesisDir, options: SessionDirOptions = {}) {
    this.noesis = noesis;
    this.id = options.id ?? uuidv7();
    this.tmpRoot = noesis.resolve(TMP_DIR_NAME);
    this.path = join(this.tmpRoot, this.id);
    this.now = options.now ?? Date.now;
    this.maxAgeMs = options.maxAgeMs ?? SESSION_MAX_AGE_MS;
    this.inlineResultLimit = options.inlineResultLimit ?? INLINE_RESULT_LIMIT;
  }

  async open(): Promise<void> {
    await mkdir(this.path, { recursive: true });
    await this.sweep();
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
    const absolute = isAbsolute(input)
      ? normalize(input)
      : resolve(this.noesis.root, input);
    if (!isInside(this.tmpRoot, absolute)) return this.notUnderTmp(input);

    let real: string;
    try {
      real = await realpath(absolute);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { ok: false, message: `No file at ${absolute}.` };
      }
      throw error;
    }
    if (!isInside(await realpath(this.tmpRoot), real)) {
      return this.notUnderTmp(input);
    }
    return { ok: true, path: absolute };
  }

  async deliver(text: string): Promise<string> {
    const bytes = Buffer.byteLength(text);
    if (bytes <= this.inlineResultLimit) return text;
    this.results += 1;
    const file = join(this.path, `result-${this.results}.txt`);
    await writeFile(file, text);
    return `The result is ${bytes} bytes, above the ${this.inlineResultLimit}-byte inline limit, and was written to ${file}. Read it from there.`;
  }

  private notUnderTmp(input: string): WorkingPathResult {
    return {
      ok: false,
      message: `${input} is not under ${relative(this.noesis.root, this.tmpRoot)}/. Tools accept only paths under .noesis/tmp/; this session's directory is ${this.path}.`,
    };
  }

  private async sweep(): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(this.tmpRoot, { withFileTypes: true });
    } catch (error) {
      log.warn('could not list {dir}: {error}', {
        dir: this.tmpRoot,
        error: String(error),
      });
      return;
    }
    const cutoff = this.now() - this.maxAgeMs;
    let swept = 0;
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === this.id) continue;
      const dir = join(this.tmpRoot, entry.name);
      try {
        if ((await stat(dir)).mtimeMs > cutoff) continue;
        await rm(dir, { recursive: true, force: true });
        swept += 1;
      } catch (error) {
        // A crashed session's leftovers are never worth failing a boot over.
        log.warn('could not sweep {dir}: {error}', {
          dir,
          error: String(error),
        });
      }
    }
    if (swept > 0) {
      log.info('swept {swept} stale session dir(s)', { swept });
    }
  }
}

/** Strictly below: the parent itself does not count. */
function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}
