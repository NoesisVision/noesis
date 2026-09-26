import type { Logger } from '@logtape/logtape';
import { SessionDir } from '#backend/adapters/in/mcp/session-dir';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import {
  loadServerConfig,
  type ServerConfig,
} from '#backend/platform/config/config';
import { NoesisDir } from '#backend/platform/files/noesis-dir';
import {
  configureLogging,
  serverLogger,
} from '#backend/platform/logging/logging';
import { production } from './process';
import { RepositoryRoot } from './repository-root';

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
 * Logging needs `.noesis/logs/`, so a failure before that point prints to
 * stderr and exits; from there on the log says what happened.
 */
export async function openWorkspace(): Promise<Workspace> {
  const config = loadServerConfig();
  const repositoryRoot = resolveRepositoryRoot(config);
  const noesis = new NoesisDir(repositoryRoot);
  await noesis.ensureInitialized();
  await configureLogging({
    logDir: noesis.logDir,
    production,
    level: config.logLevel,
  });
  const log = serverLogger();
  log.info('knowledge graph files in {path}', { path: noesis.path });

  const session = new SessionDir(noesis);
  const sessionFiles = await session.open();
  log.info('session scratch directory {path}', { path: session.path });

  return { config, noesis, session, sessionFiles, log };
}

function resolveRepositoryRoot(config: ServerConfig): string {
  const result = new RepositoryRoot({
    root: config.root,
    cwd: process.cwd(),
  }).resolve();
  if (!result.ok) {
    console.error(`[server] ${result.message}`);
    process.exit(1);
  }
  return result.root;
}
