import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { join } from 'node:path';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { logFileName, SERVE_LOG_ID } from '#backend/platform/logging/logging';
import { serverLogger } from '#backend/platform/logging/server-logger';

const log = serverLogger('backend');

/**
 * Starts `serve --managed` from the same entry this shim runs, detached so it
 * outlives the session. It has no terminal: stdin and stdout are `/dev/null`,
 * stderr its log file, so a failure before logging is configured still
 * leaves a trace. `Bun.spawn` has no detached mode.
 */
export function spawnManagedBackend(noesis: NoesisDir): void {
  const entry = process.argv[1];
  if (entry === undefined)
    throw new Error('no entry script to start the service from');
  const stderr = openSync(join(noesis.logDir, logFileName(SERVE_LOG_ID)), 'a');
  try {
    const child = spawn(process.execPath, [entry, 'serve', '--managed'], {
      cwd: noesis.root,
      env: process.env,
      detached: true,
      stdio: ['ignore', 'ignore', stderr],
    });
    child.once('error', (error) => {
      log.error('could not start the service: {error}', {
        error: String(error),
      });
    });
    child.unref();
  } finally {
    closeSync(stderr);
  }
}
