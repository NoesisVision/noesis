import { backendApi } from '#mcp/backend/backend-api';
import { BackendClient } from '#mcp/backend/backend-client';
import { spawnManagedBackend } from '#mcp/backend/backend-spawn';
import { serveDirect } from './direct';
import { serveSession } from './serve-session';
import { openWorkspace } from './workspace';

/**
 * `noesis attach`: one session, speaking MCP on stdio and forwarding every
 * tool call to the repository's backend over its `/ui` routes. The era probe
 * costs nothing and starts no backend; the first message that is not the
 * probe warms the connection.
 */
export async function attach(version: string): Promise<void> {
  const workspace = await openWorkspace();
  if (workspace.config.noDaemon) {
    serveDirect(version, workspace);
    return;
  }
  const { noesis, log } = workspace;
  const client = new BackendClient({
    lockPath: noesis.serverLockPath,
    version,
    spawnBackend: () => spawnManagedBackend(noesis),
  });
  serveSession({
    version,
    workspace,
    api: backendApi(client),
    onServing: () =>
      void client.connection().catch((error: unknown) => {
        log.warn('could not attach to the service: {error}', {
          error: String(error),
        });
      }),
    dispose: () => client.close(),
  });
}
