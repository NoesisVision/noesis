import type { Logger } from '@logtape/logtape';
import { SessionDir } from '#backend/adapters/in/mcp/session-dir';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import {
  loadServerConfig,
  type ServerConfig,
} from '#backend/platform/config/config';
import { ConfigurationError } from '#backend/platform/config/configuration-error';
import { resolveRepositoryRoot } from '#backend/platform/config/repository-root';
import { NoesisDir } from '#backend/platform/files/noesis-dir';
import { configureLogging } from '#backend/platform/logging/logging';
import { serverLogger } from '#backend/platform/logging/server-logger';
import { production } from './process';

/** Where this process runs: the repository, its `.noesis/` and this session's scratch. */
export interface Workspace {
  config: ServerConfig;
  noesis: NoesisDir;
  session: SessionDir;
  sessionFiles: SessionFiles;
  log: Logger;
}

/**
 * Everything that has to exist before either half of the server can start.
 * Logging needs `.noesis/logs/` and the session's id, so a failure before
 * that point prints to stderr and exits; from there on the log says what
 * happened.
 */
export async function openWorkspace(): Promise<Workspace> {
  const { config, repositoryRoot } = configuredOrExit();
  const noesis = new NoesisDir(repositoryRoot);
  await noesis.ensureInitialized();
  // The session is named before logging, which files by it.
  const session = new SessionDir(noesis);
  await configureLogging({
    logDir: noesis.logDir,
    sessionId: session.id,
    production,
    level: config.logLevel,
  });
  const log = serverLogger();
  log.info('knowledge graph files in {path}', { path: noesis.path });

  const sessionFiles = await session.open();
  log.info('session scratch directory {path}', { path: session.path });

  return { config, noesis, session, sessionFiles, log };
}

/** The environment and the repository, or the one reason the process will not start. */
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
