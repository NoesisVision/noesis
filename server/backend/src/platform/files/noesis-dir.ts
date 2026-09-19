import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const NOESIS_DIR_NAME = '.noesis';

const UNVERSIONED_DIRS = ['tmp', 'logs'] as const;

export class NoesisDir {
  readonly root: string;
  readonly path: string;

  constructor(repositoryRoot: string) {
    this.root = repositoryRoot;
    this.path = join(repositoryRoot, NOESIS_DIR_NAME);
  }

  resolve(...segments: string[]): string {
    return join(this.path, ...segments);
  }

  get logDir(): string {
    return this.resolve('logs');
  }

  /** An existing `.gitignore` only gains the lines it lacks. */
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
