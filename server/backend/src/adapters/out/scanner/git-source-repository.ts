import { basename } from 'node:path';
import type { SourceRepository } from '#backend/app/scanner/source-repository';

/** The repository at `root`, named after its directory, its commit read from Git. */
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
    let process: Bun.Subprocess<'ignore', 'pipe', 'ignore'>;
    try {
      process = Bun.spawn(['git', 'rev-parse', '--short', 'HEAD'], {
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
    const commit = out.trim();
    return exitCode === 0 && commit !== '' ? commit : null;
  }
}
