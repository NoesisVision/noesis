import {
  disposeLogging,
  serverLogger,
} from '#backend/platform/logging/logging';

const log = serverLogger('lifecycle');

const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;

export interface LifecycleOptions {
  /** Releases what the process holds; runs once, before logging is disposed. */
  dispose: () => Promise<void>;
}

export interface Lifecycle {
  /** Idempotent: the first call wins, later ones return at once. */
  shutdown(exitCode?: number): Promise<void>;
}

/**
 * One exit path for the process. Signals and the end of the MCP stream end
 * the session cleanly; an unhandled exception or rejection ends it too, since
 * nothing in the process is trusted afterwards — but through `shutdown()`,
 * so `.noesis/logs/` says why.
 */
export function installLifecycle(options: LifecycleOptions): Lifecycle {
  let shuttingDown = false;

  async function shutdown(exitCode = 0): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await options.dispose();
    } catch (error) {
      log.error('shutdown failed: {error}', { error: String(error) });
    }
    await disposeLogging();
    process.exit(exitCode);
  }

  function crashed(kind: 'exception' | 'rejection', error: unknown): void {
    log.fatal('unhandled {kind}: {error}', {
      kind,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    void shutdown(1);
  }

  for (const signal of SIGNALS) {
    process.on(signal, () => void shutdown());
  }
  process.on('uncaughtException', (error) => crashed('exception', error));
  process.on('unhandledRejection', (reason) => crashed('rejection', reason));

  return { shutdown };
}
