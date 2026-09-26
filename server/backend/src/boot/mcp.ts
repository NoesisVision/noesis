import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createMcpServer } from '#backend/adapters/in/mcp/mcp-server';
import { ServingTransport } from '#backend/adapters/in/mcp/serving-transport';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import type { NoesisDir } from '#backend/platform/files/noesis-dir';
import { serverLogger } from '#backend/platform/logging/logging';
import type { Services } from './services';

const log = serverLogger('mcp');

export interface McpOptions {
  version: string;
  noesis: NoesisDir;
  sessionFiles: SessionFiles;
  services: Services;
  /** The first message proving this process serves a session, not the era probe. */
  onServing: () => void;
  /** The host closed stdin: the session is over. */
  onStdinEnd: () => void;
}

export interface McpHandle {
  close(): Promise<void>;
}

/**
 * The MCP half of the server, on stdio. It costs milliseconds, because on the
 * modern era the SDK spawns a throwaway sibling process from the same command
 * to probe the protocol, and that process must not bind a port or open a
 * browser for a session it will never serve.
 *
 * `serveStdio` owns the transport and the era negotiation: the opening
 * exchange picks the protocol revision and pins one server to it for the
 * connection. The transport is ours only so that the first message that is
 * not `server/discover` can start the ui.
 */
export function serveMcp(options: McpOptions): McpHandle {
  const { version, noesis, sessionFiles, services } = options;
  const handle = serveStdio(
    () =>
      createMcpServer({
        version,
        noesis,
        sessionFiles,
        changesService: services.changesService,
        designDocsService: services.designDocsService,
        documentsService: services.documentsService,
      }),
    {
      transport: new ServingTransport(options.onServing),
      onerror: (error) => {
        log.error('the MCP transport reported {error}', {
          error: String(error),
        });
      },
    },
  );
  // The handle reports no end of stdin, which is what ends the session.
  process.stdin.once('end', () => {
    log.info('MCP stream closed — shutting down');
    options.onStdinEnd();
  });
  log.info('MCP server serving on stdio');
  return handle;
}
