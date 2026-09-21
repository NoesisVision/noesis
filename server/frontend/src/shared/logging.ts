import {
  configureSync,
  getConsoleSink,
  getLogger,
  type Logger,
} from '@logtape/logtape';

// Mirrors the service's `["noesis", "server", ...]` categories so a log line
// says which process wrote it (decision D10).
export function uiLogger(...segments: string[]): Logger {
  return getLogger(['noesis', 'ui', ...segments]);
}

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
