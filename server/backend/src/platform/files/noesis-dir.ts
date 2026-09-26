import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const NOESIS_DIR_NAME = '.noesis';
const UNVERSIONED_DIRS = ['sessions', 'logs'] as const;
const GITIGNORE_LINES = UNVERSIONED_DIRS.map((dir) => `${dir}/`);

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

  get sessionsDir(): string {
    return this.resolve('sessions');
  }

  /** An existing `.gitignore` only gains the lines it lacks. */
  async ensureInitialized(): Promise<void> {
    await this.createDirectories();
    await this.excludeUnversionedDirsFromGit();
  }

  private async createDirectories(): Promise<void> {
    await mkdir(this.path, { recursive: true });
    for (const dir of UNVERSIONED_DIRS) {
      await mkdir(this.resolve(dir), { recursive: true });
    }
  }

  /** Sessions booting at once may both append; Git tolerates the duplicate lines. */
  private async excludeUnversionedDirsFromGit(): Promise<void> {
    const existing = await this.readGitignore();
    const present = new Set(existing.split(/\r?\n/).map((line) => line.trim()));
    const missing = GITIGNORE_LINES.filter((line) => !present.has(line));
    if (missing.length === 0) return;
    // Starts on a fresh line even when the file lacks a trailing newline.
    const lineBreak = existing === '' || existing.endsWith('\n') ? '' : '\n';
    await appendFile(this.gitignorePath, `${lineBreak}${missing.join('\n')}\n`);
  }

  private async readGitignore(): Promise<string> {
    const file = Bun.file(this.gitignorePath);
    return (await file.exists()) ? await file.text() : '';
  }

  private get gitignorePath(): string {
    return this.resolve('.gitignore');
  }
}
