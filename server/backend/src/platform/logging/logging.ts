import { AsyncLocalStorage } from 'node:async_hooks';
import { join } from 'node:path';
import { getRotatingFileSink } from '@logtape/file';
import {
  configure,
  dispose,
  getAnsiColorFormatter,
  getJsonLinesFormatter,
  getLogger,
  isLogLevel,
  type Logger,
  type LogLevel,
  type Sink,
} from '@logtape/logtape';

// stdout is the MCP transport and is never written to.

const ROOT_CATEGORY = 'noesis';
export const LOG_FILE_NAME = 'noesis.log';

export function serverLogger(...segments: string[]): Logger {
  return getLogger([ROOT_CATEGORY, 'server', ...segments]);
}

export interface LoggingOptions {
  /** Must already exist: created by `NoesisDir.ensureInitialized()`. */
  logDir: string;
  /** JSON on stderr when true, coloured text otherwise. */
  production: boolean;
  level: LogLevel;
}

export const DEFAULT_LOG_LEVEL: LogLevel = 'info';

export function parseLogLevel(value: string | undefined): LogLevel {
  return value !== undefined && isLogLevel(value) ? value : DEFAULT_LOG_LEVEL;
}

export async function configureLogging(options: LoggingOptions): Promise<void> {
  const jsonLines = getJsonLinesFormatter();
  const stderrFormatter = options.production ? jsonLines : readableFormatter();
  const stderr: Sink = (record) => {
    process.stderr.write(stderrFormatter(record));
  };
  const file = getRotatingFileSink(join(options.logDir, LOG_FILE_NAME), {
    formatter: jsonLines,
    maxSize: 5 * 1024 * 1024,
    maxFiles: 5,
    // Written through: a person tailing the file, or reading it after a
    // crash, must see every line. Volume is one developer's session.
    bufferSize: 0,
  });

  await configure({
    sinks: { stderr, file },
    loggers: [
      {
        category: ROOT_CATEGORY,
        sinks: ['stderr', 'file'],
        lowestLevel: options.level,
      },
      // LogTape's own complaints (a sink that throws, a bad config) go to
      // stderr only; nothing of ours should trip them.
      {
        category: ['logtape', 'meta'],
        sinks: ['stderr'],
        lowestLevel: 'warning',
      },
    ],
    contextLocalStorage: new AsyncLocalStorage(),
  });
}

export async function disposeLogging(): Promise<void> {
  await dispose();
}

function readableFormatter() {
  return getAnsiColorFormatter({
    timestamp: 'time',
    category: '.',
    value: (value, inspect) =>
      typeof value === 'string' ? value : inspect(value, { colors: true }),
    format: ({ timestamp, level, category, message, record }) => {
      const requestId = record.properties.requestId;
      const suffix =
        typeof requestId === 'string'
          ? ` \x1b[2m(req ${requestId})\x1b[0m`
          : '';
      return `${timestamp} ${level} ${category} ${message}${suffix}`;
    },
  });
}
