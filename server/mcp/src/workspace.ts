import {
  type RepositoryWorkspace,
  locateRepository,
  startLogging,
} from '#backend/boot/workspace';
import { SessionDir } from '#mcp/session/session-dir';
import type { SessionFiles } from '#mcp/session/session-files';

/** Where a session runs: the repository and this session's scratch. */
export interface Workspace extends RepositoryWorkspace {
  session: SessionDir;
  sessionFiles: SessionFiles;
}

/**
 * Everything a session needs before it serves. Logging needs `.noesis/logs/`
 * and the session's id, so a failure before that point prints to stderr and
 * exits; from there on the log says what happened.
 */
export async function openWorkspace(): Promise<Workspace> {
  const { config, noesis } = locateRepository();
  await noesis.ensureInitialized();
  // The session is named before logging, which files by it.
  const session = new SessionDir(noesis);
  const log = await startLogging(config, noesis, session.id, true);

  const sessionFiles = await session.open();
  log.info('session scratch directory {path}', { path: session.path });

  return { config, noesis, session, sessionFiles, log };
}
