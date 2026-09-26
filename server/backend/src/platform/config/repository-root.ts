import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ConfigurationError } from './configuration-error';

export interface RepositoryRootOptions {
  /** `NOESIS_ROOT`; unset, the root is the checkout enclosing `cwd`. */
  root?: string | undefined;
  cwd: string;
}

/** No root found is a refusal to start, a `ConfigurationError`, not a default. */
export function resolveRepositoryRoot({
  root,
  cwd,
}: RepositoryRootOptions): string {
  if (root !== undefined) {
    const resolved = resolve(root);
    if (!isDirectory(resolved)) {
      throw new ConfigurationError(`NOESIS_ROOT=${root} is not a directory.`);
    }
    return resolved;
  }
  const found = findRepositoryRoot(cwd);
  if (found === null) {
    throw new ConfigurationError(
      `No git repository found above ${resolve(cwd)}. ` +
        'Start the service inside a checkout, or set NOESIS_ROOT to the ' +
        'repository root.',
    );
  }
  return found;
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
