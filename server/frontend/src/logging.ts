import {
  configureSync,
  getConsoleSink,
  getLogger,
  type Logger,
} from '@logtape/logtape';

/**
 * Logging for the browser app, on LogTape (decision D10). Same root category
 * as the service — `["noesis", "ui", <module>]` against its
 * `["noesis", "server", <module>]` — so a log line says which process wrote
 * it (docs/logging.md). One sink, the browser console, at `debug` from
 * source and `info` in the built bin.
 */

/** A logger for one module of the app: `["noesis", "ui", ...segments]`. */
export function uiLogger(...segments: string[]): Logger {
  return getLogger(['noesis', 'ui', ...segments]);
}

/** Called once, before the app renders. */
export function configureLogging(): void {
  configureSync({
    sinks: { console: getConsoleSink() },
    loggers: [
      {
        category: 'noesis',
        sinks: ['console'],
        lowestLevel: import.meta.env.PROD ? 'info' : 'debug',
      },
      {
        category: ['logtape', 'meta'],
        sinks: ['console'],
        lowestLevel: 'warning',
      },
    ],
  });

  const log = uiLogger('window');
  window.addEventListener('error', (event) => {
    log.error('uncaught error: {message}', {
      message: event.message,
      source: `${event.filename}:${event.lineno}:${event.colno}`,
      error: event.error,
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    log.error('unhandled rejection: {reason}', {
      reason: String(event.reason),
      error: event.reason,
    });
  });
}
