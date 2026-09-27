import type { Logger } from '@logtape/logtape';
import {
  loadServerConfig,
  type ServerConfig,
} from '#backend/platform/config/config';
import { ConfigurationError } from '#backend/platform/config/configuration-error';
import { resolveRepositoryRoot } from '#backend/platform/config/repository-root';
import { NoesisDir } from '#backend/platform/files/noesis-dir';
import {
  configureLogging,
  SERVE_LOG_ID,
} from '#backend/platform/logging/logging';
import { serverLogger } from '#backend/platform/logging/server-logger';
import { production } from './process';

/** The repository this process serves, and its `.noesis/`. */
export interface Repository {
  config: ServerConfig;
  noesis: NoesisDir;
}

/** Where a process runs: the repository, with logging configured. */
export interface RepositoryWorkspace extends Repository {
  log: Logger;
}

/**
 * The environment and the repository, or the one reason the process will not
 * start, printed to stderr before exiting. Nothing is created yet.
 */
export function locateRepository(): Repository {
  const { config, repositoryRoot } = configuredOrExit();
  return { config, noesis: new NoesisDir(repositoryRoot) };
}

/**
 * The daemon's workspace: no session of its own, and one log file. A managed
 * daemon's stderr already is that file, so it logs there once.
 */
export async function openDaemonWorkspace(
  managed: boolean,
): Promise<RepositoryWorkspace> {
  const { config, noesis } = locateRepository();
  await noesis.ensureInitialized();
  const log = await startLogging(config, noesis, SERVE_LOG_ID, !managed);
  return { config, noesis, log };
}

/** Logs to stderr, unless told otherwise, and to `.noesis/logs/noesis-<fileId>.log`. */
export async function startLogging(
  config: ServerConfig,
  noesis: NoesisDir,
  fileId: string,
  stderr: boolean,
): Promise<Logger> {
  await configureLogging({
    logDir: noesis.logDir,
    fileId,
    production,
    level: config.logLevel,
    stderr,
  });
  const log = serverLogger();
  log.info('knowledge graph files in {path}', { path: noesis.path });
  return log;
}

function configuredOrExit(): { config: ServerConfig; repositoryRoot: string } {
  try {
    const config = loadServerConfig(process.env);
    const repositoryRoot = resolveRepositoryRoot({
      root: config.root,
      cwd: process.cwd(),
    });
    return { config, repositoryRoot };
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error;
    console.error(`[server] ${error.message}`);
    process.exit(1);
  }
}
