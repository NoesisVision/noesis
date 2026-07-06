// Stdio MCP server entry point. Bundled into the Claude Code plugin via
// `bun run bundle` (plugins/claude-code/tools/bundle-server.ts).
//
// stdout belongs to the MCP protocol — all logging MUST go to stderr.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { LoggerService } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { helloRequestSchema } from '@repo/mcp-contracts';
import { McpModule } from './mcp/mcp.module';
import { ServerClientService } from './mcp/server-client.service';

const stderrLogger: LoggerService = {
  log: (...args: unknown[]) => console.error(...args),
  error: (...args: unknown[]) => console.error(...args),
  warn: (...args: unknown[]) => console.error(...args),
  debug: (...args: unknown[]) => console.error(...args),
  verbose: (...args: unknown[]) => console.error(...args),
};

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(McpModule, {
    logger: stderrLogger,
  });
  const serverClient = app.get(ServerClientService);

  const mcp = new McpServer({ name: 'noesis-local', version: '0.1.0' });

  mcp.registerTool(
    'hello',
    {
      description:
        'Greets a person. Fetches the greeting from the configured Noesis server over REST.',
      inputSchema: helloRequestSchema.shape,
    },
    async ({ name }) => {
      const greeting = await serverClient.hello();
      return {
        content: [{ type: 'text', text: `${greeting} Greetings, ${name}!` }],
      };
    },
  );

  await mcp.connect(new StdioServerTransport());
  console.error(
    `noesis-local MCP server running (server: ${serverClient.serverUrl})`,
  );
}

void bootstrap().catch((err) => {
  console.error('Failed to start noesis-local MCP server:', err);
  process.exit(1);
});
