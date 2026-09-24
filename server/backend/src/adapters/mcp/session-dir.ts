import type { Dirent } from 'node:fs';
import { mkdir, readdir, realpath, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { serverLogger } from '#backend/platform/logging/logging';
import { SessionFiles } from './session-files';

const log = serverLogger('session');

const SESSIONS_DIR_NAME = 'sessions';
/** Scratch left by a session that never shut down cleanly is swept after this. */
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionDirOptions {
  id?: string;
}

/**
 * This session's scratch directory under `.noesis/sessions/`, from boot to
 * shutdown. Nothing written here is graph content.
 */
export class SessionDir {
  readonly path: string;
  private readonly sessionsRoot: string;
  private readonly id: string;
  private readonly repositoryRoot: string;

  constructor(noesis: NoesisDir, options: SessionDirOptions = {}) {
    this.id = options.id ?? uuidv7();
    this.repositoryRoot = noesis.root;
    this.sessionsRoot = noesis.resolve(SESSIONS_DIR_NAME);
    this.path = join(this.sessionsRoot, this.id);
  }

  async open(): Promise<SessionFiles> {
    await mkdir(this.path, { recursive: true });
    await this.removeStaleSessionDirs();
    return this.sessionFiles();
  }

  async dispose(): Promise<void> {
    await rm(this.path, { recursive: true, force: true });
  }

  private async sessionFiles(): Promise<SessionFiles> {
    return new SessionFiles({
      repositoryRoot: this.repositoryRoot,
      sessionsRoot: this.sessionsRoot,
      realSessionsRoot: await realpath(this.sessionsRoot),
      dir: this.path,
    });
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
