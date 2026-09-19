import { serverLogger } from './platform/logging/logging';

const log = serverLogger('browser');

// Best effort: a missing opener is logged, never fatal.
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
