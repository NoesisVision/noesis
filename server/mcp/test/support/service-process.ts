import { type ChildProcess, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { Stream } from 'node:stream';

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

/**
 * A session attaches only once served: the shim answers the SDK's era probe
 * without the backend, so a spec must first look like a host with work to
 * do. One `ping` is enough — anything but `server/discover` is.
 */
export function startServing(child: ChildProcess): void {
  child.stdin?.write(
    `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })}\n`,
  );
}

/** The backend's URL, as a session announces it once attached. */
export function attachedUrl(
  source: ChildProcess | Stream,
  timeoutMs: number,
): Promise<string> {
  const stderr = 'stderr' in source ? source.stderr : source;
  return new Promise((resolveUrl, reject) => {
    let log = '';
    const timer = setTimeout(
      () =>
        reject(
          new Error(`No "attached to" line within ${timeoutMs}ms:\n${log}`),
        ),
      timeoutMs,
    );
    // Text while developing, a JSON line from the built bin: both carry the
    // URL after the phrase, the JSON one in escaped quotes.
    stderr?.on('data', (chunk: Buffer) => {
      log += chunk.toString();
      const match = /attached to \\?"?(http:\/\/[^\s"\\]+)/.exec(log);
      if (match?.[1]) {
        clearTimeout(timer);
        resolveUrl(match[1].replace(/\/$/, ''));
      }
    });
    if ('stderr' in source) {
      source.on('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Shim exited with ${code} before attaching:\n${log}`));
      });
    }
  });
}

/** `noesis stop` for the repository, so no backend outlives a spec. */
export function stopService(repositoryRoot: string): void {
  spawnSync('bun', ['run', 'src/main.ts', 'stop'], {
    cwd: serviceRoot,
    env: serviceEnv(repositoryRoot),
    stdio: 'ignore',
  });
}
