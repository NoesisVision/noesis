import { serverLogger } from './infra/logging/logging.js';

const log = serverLogger('browser');

/**
 * Opens the default browser on a URL, once, at boot — the UI exists while the
 * agent session does, and this is how the person finds it (decision D1).
 * Best effort: a missing opener is logged, never fatal.
 */
export function openBrowser(url: string): void {
  const command =
    process.platform === 'darwin'
      ? ['open', url]
      : process.platform === 'win32'
        ? ['cmd', '/c', 'start', '', url]
        : ['xdg-open', url];
  try {
    Bun.spawn(command, { stdout: 'ignore', stderr: 'ignore', stdin: 'ignore' })
      .exited.then((code) => {
        if (code !== 0) {
          log.warn('could not open the browser (exit {code})', { code });
        }
      })
      .catch(() => undefined);
  } catch (error) {
    log.warn('could not open the browser: {error}', { error: String(error) });
  }
}
