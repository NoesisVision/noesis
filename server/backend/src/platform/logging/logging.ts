import { AsyncLocalStorage } from 'node:async_hooks';
import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { getFileSink } from '@logtape/file';
import {
  configure,
  dispose,
  getAnsiColorFormatter,
  getJsonLinesFormatter,
  type LogLevel,
  type Sink,
} from '@logtape/logtape';
import { ROOT_CATEGORY, serverLogger } from './server-logger';

// stdout is the MCP transport and is never written to.

const LOG_FILE_PREFIX = 'noesis-';
export const LOG_FILE_SUFFIX = '.log';

/** A session's log is swept this long after its last line, at a later boot. */
export const LOG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The daemon's file: the lock allows one daemon per repository at a time, so
 * the name is fixed, and no sweep removes it.
 */
export const SERVE_LOG_ID = 'serve';

/**
 * Each process logs to a file of its own: a session by its id, the daemon by
 * `SERVE_LOG_ID`. One file shared by every process cannot be rotated: the
 * process that renames it keeps writing to the new one, while every other
 * keeps its descriptor on the renamed file, then on nothing once that is
 * unlinked.
 */
export function logFileName(fileId: string): string {
  return `${LOG_FILE_PREFIX}${fileId}${LOG_FILE_SUFFIX}`;
}

export interface LoggingOptions {
  /** Must already exist: created by `NoesisDir.ensureInitialized()`. */
  logDir: string;
  /** Names this process's file: `noesis-<fileId>.log`. */
  fileId: string;
  /** JSON on stderr when true, coloured text otherwise. */
  production: boolean;
  /**
   * `false` when stderr is the log file itself — a managed daemon's — so
   * each line is written once.
   */
  stderr?: boolean;
  level: LogLevel;
}

export const DEFAULT_LOG_LEVEL: LogLevel = 'info';

export async function configureLogging(options: LoggingOptions): Promise<void> {
  const jsonLines = getJsonLinesFormatter();
  const stderrFormatter = options.production ? jsonLines : readableFormatter();
  const stderr: Sink = (record) => {
    process.stderr.write(stderrFormatter(record));
  };
  const file = getFileSink(join(options.logDir, logFileName(options.fileId)), {
    formatter: jsonLines,
    // Written through: a person tailing the file, or reading it after a
    // crash, must see every line. Volume is one developer's session.
    bufferSize: 0,
  });

  await configure({
    sinks: { stderr, file },
    loggers: [
      {
        category: ROOT_CATEGORY,
        sinks: options.stderr === false ? ['file'] : ['stderr', 'file'],
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
  await removeStaleLogs(options.logDir, options.fileId);
}

export async function disposeLogging(): Promise<void> {
  await dispose();
}

/**
 * Sweeps the logs of sessions that ended long ago. A live session's file has
 * its last line's mtime, so age alone tells; this process's own file and the
 * daemon's are skipped regardless. Never worth failing a boot over.
 */
async function removeStaleLogs(logDir: string, fileId: string) {
  const log = serverLogger('logging');
  const cutoff = Date.now() - LOG_MAX_AGE_MS;
  let removed = 0;
  for (const name of await listLogs(logDir)) {
    if (name === logFileName(fileId) || name === logFileName(SERVE_LOG_ID)) {
      continue;
    }
    const path = join(logDir, name);
    try {
      if ((await stat(path)).mtimeMs > cutoff) continue;
      await rm(path, { force: true });
      removed += 1;
    } catch (error) {
      log.warn('could not sweep {path}: {error}', {
        path,
        error: String(error),
      });
    }
  }
  if (removed > 0) log.info('swept {swept} stale log(s)', { swept: removed });
}

async function listLogs(logDir: string): Promise<string[]> {
  try {
    return (await readdir(logDir)).filter(
      (name) =>
        name.startsWith(LOG_FILE_PREFIX) && name.endsWith(LOG_FILE_SUFFIX),
    );
  } catch (error) {
    serverLogger('logging').warn('could not list {dir}: {error}', {
      dir: logDir,
      error: String(error),
    });
    return [];
  }
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
