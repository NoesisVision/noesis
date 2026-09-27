import { serveStdio } from '@modelcontextprotocol/server/stdio';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { serverLogger } from '#backend/platform/logging/server-logger';
import type { NoesisApi } from '#mcp/api/noesis-api';
import { createMcpServer } from '#mcp/server/mcp-server';
import { ServingTransport } from '#mcp/server/serving-transport';
import type { SessionFiles } from '#mcp/session/session-files';

const log = serverLogger('mcp');

export interface McpOptions {
  version: string;
  noesis: NoesisDir;
  sessionFiles: SessionFiles;
  api: NoesisApi;
  /** The first message proving this process serves a session, not the era probe. */
  onServing: () => void;
  /** The host's first message, the probe's included. */
  onFirstMessage: () => void;
}

export interface McpHandle {
  close(): Promise<void>;
}

/**
 * The MCP half of a session, on stdio. It costs milliseconds, because on the
 * modern era the SDK spawns a throwaway sibling process from the same command
 * to probe the protocol, and that process must not start a backend, bind a
 * port or open a browser for a session it will never serve.
 *
 * `serveStdio` owns the transport and the era negotiation: the opening
 * exchange picks the protocol revision and pins one server to it for the
 * connection. The transport is ours only so that the first message that is
 * not `server/discover` can start what the session needs.
 */
export function serveMcp(options: McpOptions): McpHandle {
  const { version, noesis, sessionFiles, api } = options;
  const handle = serveStdio(
    () => createMcpServer({ version, noesis, sessionFiles, api }),
    {
      transport: new ServingTransport({
        onFirstMessage: options.onFirstMessage,
        onServing: options.onServing,
      }),
      onerror: (error) => {
        log.error('the MCP transport reported {error}', {
          error: String(error),
        });
      },
    },
  );
  log.info('MCP server serving on stdio');
  return handle;
}
