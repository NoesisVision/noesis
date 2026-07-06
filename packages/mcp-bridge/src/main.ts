// Stdio MCP entry point — the bridge between a coding agent (MCP over stdio)
// and the server app's /api surface (REST). Published to npm as
// @noesis-vision/mcp-bridge (self-contained dist/main.js bin, built by
// `bun run build`); agent plugins launch it via bunx (decision 33).
//
// stdout belongs to the MCP protocol — all logging MUST go to stderr.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { createMcpServer } from './mcp-server.js';
import { ServerClient } from './server-client.js';

// The composition root (same pattern as apps/server): the ONE place that
// constructs dependencies and wires them together.
try {
  const serverClient = new ServerClient(loadConfig());
  const mcp = createMcpServer(serverClient);
  await mcp.connect(new StdioServerTransport());
  console.error(
    `noesis-local MCP server running (server: ${serverClient.serverUrl})`,
  );
} catch (err) {
  console.error('Failed to start noesis-local MCP server:', err);
  process.exit(1);
}
