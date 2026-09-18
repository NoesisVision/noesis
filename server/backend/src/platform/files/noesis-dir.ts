import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const NOESIS_DIR_NAME = '.noesis';

/** The subdirectories git must not see: scratch space and the service's logs. */
export const UNVERSIONED_DIRS = ['tmp', 'logs'] as const;

/**
 * The `.noesis/` directory at the repository root: the one place every
 * knowledge graph file lives, one subdirectory per kind. Only the file
 * repositories build paths under it; everything else in the backend goes
 * through them.
 *
 * Two paths under it are not versioned — `tmp/`, scratch space between the
 * agent and the service, and `logs/`, the service's log file — so the first
 * run writes a `.gitignore` that says exactly that, and a later run adds a
 * line an older `.gitignore` lacks. Every other file under `.noesis/` is
 * meant to be committed alongside the code it describes (decision D2).
 */
export class NoesisDir {
  readonly root: string;
  readonly path: string;

  constructor(repositoryRoot: string) {
    this.root = repositoryRoot;
    this.path = join(repositoryRoot, NOESIS_DIR_NAME);
  }

  /** A path under `.noesis/`, by segments. */
  resolve(...segments: string[]): string {
    return join(this.path, ...segments);
  }

  /** Where the service writes its log file. */
  get logDir(): string {
    return this.resolve('logs');
  }

  /**
   * Creates `.noesis/`, the unversioned directories and the `.gitignore`
   * covering them; an existing `.gitignore` only gains the lines it lacks.
   */
  async ensure(): Promise<void> {
    await mkdir(this.path, { recursive: true });
    for (const dir of UNVERSIONED_DIRS) {
      await mkdir(this.resolve(dir), { recursive: true });
    }
    const gitignore = this.resolve('.gitignore');
    const wanted = UNVERSIONED_DIRS.map((dir) => `${dir}/`);
    try {
      await writeFile(gitignore, `${wanted.join('\n')}\n`, { flag: 'wx' });
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const existing = await readFile(gitignore, 'utf8');
    const lines = new Set(existing.split(/\r?\n/).map((line) => line.trim()));
    const missing = wanted.filter((line) => !lines.has(line));
    if (missing.length === 0) return;
    const separator = existing === '' || existing.endsWith('\n') ? '' : '\n';
    await appendFile(gitignore, `${separator}${missing.join('\n')}\n`);
  }
}
