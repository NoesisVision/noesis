import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** No root found is a refusal to start, not a default. */
export type RootResult =
  | { ok: true; root: string }
  | { ok: false; message: string };

export interface RepositoryRootOptions {
  root?: string | undefined;
  cwd: string;
}

export class RepositoryRoot {
  private readonly configured: string | undefined;
  private readonly cwd: string;

  constructor(options: RepositoryRootOptions) {
    this.configured = options.root;
    this.cwd = options.cwd;
  }

  resolve(): RootResult {
    return this.configured === undefined
      ? this.fromEnclosingCheckout()
      : this.fromConfiguredRoot(this.configured);
  }

  private fromConfiguredRoot(configured: string): RootResult {
    const root = resolve(configured);
    if (!isDirectory(root)) {
      return {
        ok: false,
        message: `NOESIS_ROOT=${configured} is not a directory.`,
      };
    }
    return { ok: true, root };
  }

  private fromEnclosingCheckout(): RootResult {
    const found = findRepositoryRoot(this.cwd);
    if (found === null) return this.noCheckoutAbove();
    return { ok: true, root: found };
  }

  private noCheckoutAbove(): RootResult {
    return {
      ok: false,
      message:
        `No git repository found above ${resolve(this.cwd)}. ` +
        'Start the service inside a checkout, or set NOESIS_ROOT to the ' +
        'repository root.',
    };
  }
}

/** `.git` is a directory in a checkout but a file in a worktree. */
function findRepositoryRoot(start: string): string | null {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
