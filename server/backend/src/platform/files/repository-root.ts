import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** No root found is a refusal to start, not a default (decision D2). */
export type RootResult =
  | { ok: true; root: string }
  | { ok: false; message: string };

/** `.git` is a directory in a checkout but a file in a worktree. */
export function findRepositoryRoot(start: string): string | null {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function resolveRepositoryRoot(options: {
  root?: string | undefined;
  cwd: string;
}): RootResult {
  if (options.root !== undefined) {
    const root = resolve(options.root);
    if (!isDirectory(root)) {
      return {
        ok: false,
        message: `NOESIS_ROOT=${options.root} is not a directory.`,
      };
    }
    return { ok: true, root };
  }
  const found = findRepositoryRoot(options.cwd);
  if (found === null) {
    return {
      ok: false,
      message:
        `No git repository found above ${resolve(options.cwd)}. ` +
        'Start the service inside a checkout, or set NOESIS_ROOT to the ' +
        'repository root.',
    };
  }
  return { ok: true, root: found };
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
