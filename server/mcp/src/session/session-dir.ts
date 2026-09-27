import type { Dirent } from 'node:fs';
import {
  mkdir,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { serverLogger } from '#backend/platform/logging/server-logger';
import { processRunning } from '#backend/platform/process/process-identity';
import { SessionFiles } from './session-files';

const log = serverLogger('session');

/** Scratch left by a session that never shut down cleanly is swept after this. */
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Names the process a session directory belongs to, so a sweep can ask
 * whether it still runs. The directory's own mtime cannot say: editing a
 * file inside leaves it untouched, so a week-old session still at work looks
 * abandoned by age alone.
 */
export const OWNER_FILE_NAME = 'owner.json';

const Owner = z.object({ pid: z.number().int().positive() });

export interface SessionDirOptions {
  id?: string;
}

/**
 * This session's scratch directory under `.noesis/sessions/`, from boot to
 * shutdown. Nothing written here is graph content.
 */
export class SessionDir {
  readonly path: string;
  /** Minted here, so a caller may name things by it before `open()`. */
  readonly id: string;
  private readonly sessionsRoot: string;
  private readonly repositoryRoot: string;

  constructor(noesis: NoesisDir, options: SessionDirOptions = {}) {
    this.id = options.id ?? uuidv7();
    this.repositoryRoot = noesis.root;
    this.sessionsRoot = noesis.sessionsDir;
    this.path = join(this.sessionsRoot, this.id);
  }

  async open(): Promise<SessionFiles> {
    await mkdir(this.path, { recursive: true });
    await writeFile(
      join(this.path, OWNER_FILE_NAME),
      JSON.stringify({ pid: process.pid }),
    );
    await this.removeStaleSessionDirs();
    return new SessionFiles({
      repositoryRoot: this.repositoryRoot,
      sessionsRoot: this.sessionsRoot,
      realSessionsRoot: await realpath(this.sessionsRoot),
      dir: this.path,
    });
  }

  async dispose(): Promise<void> {
    await rm(this.path, { recursive: true, force: true });
  }

  private async removeStaleSessionDirs(): Promise<void> {
    const cutoff = Date.now() - SESSION_MAX_AGE_MS;
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

  /**
   * Stale: older than the cutoff and not owned by a running process. A
   * crashed session's leftovers are never worth failing a boot over.
   */
  private async removeIfStale(dir: string, cutoff: number): Promise<boolean> {
    try {
      if ((await stat(dir)).mtimeMs > cutoff) return false;
      if (await ownerRunning(dir)) return false;
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

/** False for a directory without a readable owner: the sweep then goes by age. */
async function ownerRunning(dir: string): Promise<boolean> {
  let owner: z.infer<typeof Owner>;
  try {
    owner = Owner.parse(
      JSON.parse(await readFile(join(dir, OWNER_FILE_NAME), 'utf8')),
    );
  } catch {
    return false;
  }
  return processRunning(owner.pid);
}
