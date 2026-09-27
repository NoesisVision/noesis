import { disposeLogging } from '#backend/platform/logging/logging';
import { Daemon } from './daemon';
import { installLifecycle } from './lifecycle';
import { createServices } from './services';
import { openDaemonWorkspace } from './workspace';

/**
 * `noesis serve`: the repository's daemon. Started by hand it runs until a
 * signal; started by a shim (`--managed`) it also exits once no session has
 * been attached for the grace period.
 */
export async function serve(version: string, managed: boolean): Promise<void> {
  const { config, noesis, log } = await openDaemonWorkspace(managed);
  // Installed before the daemon starts: a signal while it registers or binds
  // goes through `shutdown()` too, and the grace timer it arms finds the
  // lifecycle in place whenever it fires.
  let daemon: Daemon | undefined;
  const lifecycle = installLifecycle({
    dispose: async () => {
      await daemon?.shutdown();
    },
  });
  const start = await Daemon.start({
    config,
    noesis,
    version,
    services: createServices(noesis),
    managed,
    onIdle: () => void lifecycle.shutdown(),
  }).catch(async (error: unknown) => {
    log.fatal('the daemon did not start: {error}', { error: String(error) });
    await disposeLogging();
    process.exit(1);
  });

  if (!start.started) {
    const { owner } = start;
    if (owner.port === undefined) {
      log.info('already starting (pid {pid})', { pid: owner.pid });
    } else {
      log.info('already running at {url} (pid {pid})', {
        url: `http://localhost:${owner.port}/`,
        pid: owner.pid,
      });
    }
    await disposeLogging();
    process.exit(managed ? 0 : 1);
  }

  daemon = start.daemon;
}
