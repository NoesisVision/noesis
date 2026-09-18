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

/**
 * Logging for the service, on LogTape (decision D10).
 *
 * Categories are `["noesis", "server", <module>]` — the browser app uses
 * `["noesis", "ui", <module>]` — so one root category covers the product and
 * the second segment says which process spoke (docs/logging.md).
 *
 * Two sinks, both always on:
 *
 * - stderr, for the person watching the terminal or the host's MCP log:
 *   coloured text while developing, JSON lines in production. stdout is the
 *   MCP transport and is never written to.
 * - `.noesis/logs/noesis.log`, always JSON lines, rotated by size, written
 *   through so `tail -f` sees a line the moment it is logged.
 *
 * Request-scoped context (`requestId` and friends) rides on
 * `AsyncLocalStorage`: the Hono middleware and the MCP dispatcher open a
 * context, and every log line under it carries the fields.
 */

const ROOT_CATEGORY = 'noesis';
export const LOG_FILE_NAME = 'noesis.log';

/** A logger for one module of the service: `["noesis", "server", ...segments]`. */
export function serverLogger(...segments: string[]): Logger {
  return getLogger([ROOT_CATEGORY, 'server', ...segments]);
}

export interface LoggingOptions {
  /** Where `noesis.log` goes; created by `NoesisDir.ensure()`. */
  logDir: string;
  /** JSON on stderr when true, coloured text otherwise. */
  production: boolean;
  /** The lowest level written to both sinks. */
  level: LogLevel;
}

export const DEFAULT_LOG_LEVEL: LogLevel = 'info';

/** Parses `NOESIS_LOG_LEVEL`; anything unknown or unset is the default. */
export function parseLogLevel(value: string | undefined): LogLevel {
  return value !== undefined && isLogLevel(value) ? value : DEFAULT_LOG_LEVEL;
}

/** Called once, by the composition root, after `.noesis/` exists. */
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

/** Flushes and closes the sinks; part of the service's shutdown. */
export async function disposeLogging(): Promise<void> {
  await dispose();
}

/**
 * The development line: time, level, dotted category, the message with
 * strings unquoted, and the request id when the line was logged inside one.
 */
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
