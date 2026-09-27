import open from 'open';
import { serverLogger } from '#backend/platform/logging/server-logger';

const log = serverLogger('browser');

// Best effort: a missing opener is logged, never fatal.
export async function openBrowser(url: string): Promise<void> {
  try {
    const opener = await open(url);
    opener.once('exit', (code) => {
      if (code !== 0) {
        log.warn('could not open the browser (exit {code})', { code });
      }
    });
  } catch (error) {
    log.warn('could not open the browser: {error}', { error: String(error) });
  }
}
