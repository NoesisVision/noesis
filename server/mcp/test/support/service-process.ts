import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

/** The backend workspace, whose `src/main.ts` is the one bin the shim runs from. */
export const serviceRoot = resolve(__dirname, '../../../backend');

// A throwaway repository root, so the run writes no `.noesis/` into the
// checkout.
export function serviceEnv(repositoryRoot: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) env[name] = value;
  }
  return { ...env, NOESIS_ROOT: repositoryRoot, NOESIS_OPEN_BROWSER: '0' };
}

/** `noesis stop` for the repository, so no backend outlives a spec. */
export function stopService(repositoryRoot: string): void {
  spawnSync('bun', ['run', 'src/main.ts', 'stop'], {
    cwd: serviceRoot,
    env: serviceEnv(repositoryRoot),
    stdio: 'ignore',
  });
}
