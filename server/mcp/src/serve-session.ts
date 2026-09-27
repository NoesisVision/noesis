import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { installLifecycle } from '#backend/boot/lifecycle';
import { serverLogger } from '#backend/platform/logging/server-logger';
import type { NoesisApi } from '#mcp/backend/noesis-api';
import { createMcpServer } from '#mcp/server/mcp-server';
import { ServingTransport } from '#mcp/server/serving-transport';
import { watchHost } from './host-watch';
import type { Workspace } from './workspace';

const log = serverLogger('mcp');

export interface SessionOptions {
  version: string;
  workspace: Workspace;
  /** The `/ui` surface every tool forwards its call to. */
  api: NoesisApi;
  /** The first message proving this process serves a session, not the era probe. */
  onServing: () => void;
  /** Releases what the mode holds — its backend connection, or its own ui. */
  dispose: () => Promise<void> | void;
}

/**
 * One session on stdio, whichever way its tools reach the `/ui` routes: the
 * MCP server, the watch on its host and the one order of release, shared by
 * `attach` and direct mode.
 *
 * The MCP half costs milliseconds, because on the modern era the SDK spawns
 * a throwaway sibling process from the same command to probe the protocol,
 * and that process must not start a backend, bind a port or open a browser
 * for a session it will never serve. `serveStdio` owns the transport and the
 * era negotiation: the opening exchange picks the protocol revision and pins
 * one server to it for the connection. The transport is ours only so that the
 * first message that is not `server/discover` can start what the session
 * needs.
 */
export function serveSession(options: SessionOptions): void {
  const { version, api, onServing } = options;
  const { config, noesis, session, sessionFiles } = options.workspace;
  const lifecycle = installLifecycle({ dispose: release });
  const watch = watchHost(config, lifecycle);

  const mcp = serveStdio(
    () => createMcpServer({ version, noesis, sessionFiles, api }),
    {
      transport: new ServingTransport({
        onFirstMessage: () => watch.noticeInput(),
        onServing,
      }),
      onerror: (error) => {
        log.error('the MCP transport reported {error}', {
          error: String(error),
        });
      },
    },
  );
  log.info('MCP server serving on stdio');
  watch.start();

  async function release(): Promise<void> {
    watch.stop();
    await options.dispose();
    await mcp.close();
    await session.dispose();
  }
}
