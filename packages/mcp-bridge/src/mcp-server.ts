import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  type ContractName,
  contracts,
  type HelloRequest,
  toJsonSchema,
} from './contracts/index.js';
import type { ServerClient } from './server-client.js';

interface ToolDefinition {
  description: string;
  /** Contract whose zod schema validates the arguments and whose JSON Schema is advertised. */
  contract: ContractName;
  /** Receives arguments already validated against the contract. */
  handler: (payload: unknown) => Promise<CallToolResult>;
}

function errorResult(text: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text }] };
}

/**
 * Builds the MCP server and registers its tools; transport wiring stays in main.ts.
 *
 * Validation is owned here, not by the SDK (decision 34): the SDK's built-in
 * input validation rejects bad payloads with a protocol-level InvalidParams
 * error, while the MCP spec wants tool-level failures in-band (`isError`) so
 * the calling model can read the problem and correct itself. Each tool
 * advertises the exact JSON Schema generated from its contract — the same
 * schema the plugin skill ships as a reference.
 */
export function createMcpServer(serverClient: ServerClient): Server {
  const tools: Record<string, ToolDefinition> = {
    hello: {
      description:
        'Greets a person. Fetches the greeting from the configured Noesis server over REST.',
      contract: 'hello-request',
      handler: async (payload) => {
        const { name } = payload as HelloRequest;
        const greeting = await serverClient.hello();
        return {
          content: [{ type: 'text', text: `${greeting} Greetings, ${name}!` }],
        };
      },
    },
  };

  const server = new Server(
    { name: 'noesis-local', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: Object.entries(tools).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: toJsonSchema(
        contracts[tool.contract],
      ) as Tool['inputSchema'],
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools[request.params.name];
    if (!tool) {
      return errorResult(
        `Unknown tool "${request.params.name}". Available tools: ${Object.keys(tools).join(', ')}.`,
      );
    }

    const contract = contracts[tool.contract];
    const parsed = contract.schema.safeParse(request.params.arguments ?? {});
    if (!parsed.success) {
      return errorResult(
        [
          `Invalid arguments for tool "${request.params.name}" — the payload does not match the "${tool.contract}" contract:`,
          z.prettifyError(parsed.error),
          `Correct the payload and call the tool again. Valid example: ${JSON.stringify(contract.example)}`,
        ].join('\n\n'),
      );
    }

    return tool.handler(parsed.data);
  });

  return server;
}
