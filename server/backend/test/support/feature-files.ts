import { cp } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Copies the feature files at `paths` under `from` to the same paths under
 * `root`, and makes `root` a Git repository that tracks them: the scan reads
 * only the feature files Git tracks.
 */
export async function trackFeatureFiles(
  root: string,
  from: string,
  paths: readonly string[],
): Promise<void> {
  for (const path of paths) await cp(join(from, path), join(root, path));
  await git(root, ['init', '-q']);
  await git(root, ['add', '--', ...paths]);
}

async function git(cwd: string, args: string[]): Promise<void> {
  const process = Bun.spawn(['git', ...args], {
    cwd,
    stdout: 'ignore',
    stderr: 'pipe',
  });
  const [err, code] = await Promise.all([
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (code !== 0) throw new Error(`git ${args.join(' ')} failed: ${err}`);
}
