import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** No root found is a refusal to start, not a default. */
export type RootResult =
  | { ok: true; root: string }
  | { ok: false; message: string };

export interface RepositoryRootOptions {
  /** `NOESIS_ROOT`; unset, the root is the checkout enclosing `cwd`. */
  root?: string | undefined;
  cwd: string;
}

export function resolveRepositoryRoot({
  root,
  cwd,
}: RepositoryRootOptions): RootResult {
  if (root !== undefined) {
    const resolved = resolve(root);
    return isDirectory(resolved)
      ? { ok: true, root: resolved }
      : { ok: false, message: `NOESIS_ROOT=${root} is not a directory.` };
  }
  const found = findRepositoryRoot(cwd);
  if (found !== null) return { ok: true, root: found };
  return {
    ok: false,
    message:
      `No git repository found above ${resolve(cwd)}. ` +
      'Start the service inside a checkout, or set NOESIS_ROOT to the ' +
      'repository root.',
  };
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
