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
    const missing = MissingLines.of(GITIGNORE_LINES, existing);
    if (missing.isEmpty) return;
    await appendFile(this.gitignorePath, missing.appendableTo(existing));
  }

  private async readGitignore(): Promise<string> {
    const file = Bun.file(this.gitignorePath);
    return (await file.exists()) ? await file.text() : '';
  }

  private get gitignorePath(): string {
    return this.resolve('.gitignore');
  }
}

class MissingLines {
  readonly lines: readonly string[];

  private constructor(lines: readonly string[]) {
    this.lines = lines;
  }

  static of(wanted: readonly string[], content: string): MissingLines {
    const present = new Set(content.split(/\r?\n/).map((line) => line.trim()));
    return new MissingLines(wanted.filter((line) => !present.has(line)));
  }

  get isEmpty(): boolean {
    return this.lines.length === 0;
  }

  /** Starts on a fresh line even when `content` lacks a trailing newline. */
  appendableTo(content: string): string {
    const lineBreak = content === '' || content.endsWith('\n') ? '' : '\n';
    return `${lineBreak}${this.lines.join('\n')}\n`;
  }
}
