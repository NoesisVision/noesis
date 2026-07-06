import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { helloRequestSchema } from '@repo/mcp-contracts';
import type { ServerClient } from './server-client.js';

/** Builds the MCP server and registers its tools; transport wiring stays in main.ts. */
export function createMcpServer(serverClient: ServerClient): McpServer {
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

  return mcp;
}
