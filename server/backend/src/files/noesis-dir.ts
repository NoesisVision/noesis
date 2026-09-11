import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const NOESIS_DIR_NAME = '.noesis';

/**
 * The `.noesis/` directory at the repository root: the one place every
 * knowledge graph file lives, one subdirectory per kind. Only the file
 * repositories build paths under it; everything else in the backend goes
 * through them.
 *
 * `tmp/` is the sole path under it that is not versioned — scratch space
 * between the agent and the service — so the first run writes a `.gitignore`
 * that says exactly that. Every other file under `.noesis/` is meant to be
 * committed alongside the code it describes (decision 68, points 7 and 8).
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

  /** Creates `.noesis/` and its `.gitignore` when they are missing. */
  async ensure(): Promise<void> {
    await mkdir(this.path, { recursive: true });
    const gitignore = this.resolve('.gitignore');
    try {
      await writeFile(gitignore, 'tmp/\n', { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
}
