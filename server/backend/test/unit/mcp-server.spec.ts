// Drives createMcpServer through a real MCP client over an in-memory
// transport, pinning the validation contract of decision 34: schema problems
// come back in-band (isError result) with actionable, per-field text — never
// as protocol-level InvalidParams errors the model cannot easily act on.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../../src/mcp/mcp-server.js';

let client: Client;

beforeAll(async () => {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = createMcpServer({ repositoryRoot: '/work/repo' });
  await server.connect(serverTransport);

  client = new Client({ name: 'mcp-server-spec', version: '0.0.0' });
  await client.connect(clientTransport);
});

afterAll(async () => {
  await client?.close();
});

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
  const [content] = result.content as { type: string; text: string }[];
  return content?.text ?? '';
}

describe('createMcpServer', () => {
  it('states the repository root in its instructions', () => {
    expect(client.getInstructions()).toContain('/work/repo');
  });

  it('advertises each tool with the JSON Schema generated from its contract', async () => {
    const { tools } = await client.listTools();
    const hello = tools.find((t) => t.name === 'hello');
    expect(hello).toBeDefined();
    expect(hello?.inputSchema.type).toBe('object');
    expect(hello?.inputSchema.required).toEqual(['name']);
  });

  it('answers a valid call', async () => {
    const result = await client.callTool({
      name: 'hello',
      arguments: { name: 'Ada' },
    });
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toBe('Greetings, Ada!');
  });

  it('returns a descriptive in-band error for a schema violation', async () => {
    const result = await client.callTool({
      name: 'hello',
      arguments: { unexpected: true },
    });
    expect(result.isError).toBe(true);
    const text = textOf(result);
    // Actionable pieces: the failing contract, the field, and a valid example.
    expect(text).toContain('hello-request');
    expect(text).toContain('name');
    expect(text).toContain('Valid example: {"name":"Ada"}');
  });

  it('returns a descriptive in-band error for a field-level violation', async () => {
    const result = await client.callTool({
      name: 'hello',
      arguments: { name: '' },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('name');
  });

  it('returns an in-band error listing available tools for an unknown tool', async () => {
    const result = await client.callTool({
      name: 'no-such-tool',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Available tools: hello');
  });
});
