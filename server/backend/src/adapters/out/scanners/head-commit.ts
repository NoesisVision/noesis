/**
 * The short hash of the commit checked out in `root`; null outside a Git
 * repository, before the first commit, or without Git on the PATH.
 */
export async function headCommit(root: string): Promise<string | null> {
  let process: Bun.Subprocess<'ignore', 'pipe', 'ignore'>;
  try {
    process = Bun.spawn(['git', 'rev-parse', '--short', 'HEAD'], {
      cwd: root,
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
