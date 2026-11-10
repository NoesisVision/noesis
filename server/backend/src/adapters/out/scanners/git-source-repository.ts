import { basename, join } from 'node:path';
import type { FeatureFileSource } from '#backend/app/scanners/feature-files/feature-file';
import type { SourceRepository } from '#backend/app/scanners/source-repository';

/** The repository at `root`, named after its directory, its commit and files read from Git. */
export class GitSourceRepository implements SourceRepository {
  readonly name: string;
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
    this.name = basename(root);
  }

  /**
   * The short hash of the commit checked out; null outside a Git repository,
   * before the first commit, or without Git on the PATH.
   */
  async headCommit(): Promise<string | null> {
    const out = await this.git(['rev-parse', '--short', 'HEAD']);
    const commit = out?.trim() ?? '';
    return commit === '' ? null : commit;
  }

  /**
   * The `*.feature` files Git tracks under the root, as the working tree
   * has them, sorted by path; none outside a Git repository or without Git.
   * A tracked file deleted from the working tree is passed over.
   */
  async featureFiles(): Promise<FeatureFileSource[]> {
    const out = await this.git(['ls-files', '-z', '--', '*.feature']);
    const paths = (out ?? '').split('\0').filter((path) => path !== '');
    const files = await Promise.all(
      paths.sort(byCodeUnit).map(async (path) => {
        const file = Bun.file(join(this.root, path));
        return (await file.exists()) ? { path, text: await file.text() } : null;
      }),
    );
    return files.filter((file) => file !== null);
  }

  /** What `git <args>` prints in the root; null when it fails or Git is not on the PATH. */
  private async git(args: string[]): Promise<string | null> {
    let process: Bun.Subprocess<'ignore', 'pipe', 'ignore'>;
    try {
      process = Bun.spawn(['git', ...args], {
        cwd: this.root,
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'ignore',
      });
    } catch {
      return null;
    }
    const [out, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      process.exited,
    ]);
    return exitCode === 0 ? out : null;
  }
}

/** Paths are sorted by code unit, as Git lists them, without a locale. */
function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
