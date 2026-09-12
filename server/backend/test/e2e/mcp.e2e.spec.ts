// Full-stack MCP e2e: boots the real service (src/main.ts) as a stdio MCP
// server the way an agent host does, and drives an actual `tools/call`.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const serviceRoot = resolve(__dirname, '../..');

let repoRoot: string;
let client: Client;

beforeAll(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'noesis-root-'));
  client = new Client({ name: 'mcp-e2e-test', version: '0.0.0' });
  await client.connect(
    new StdioClientTransport({
      command: 'bun',
      args: ['run', 'src/main.ts'],
      cwd: serviceRoot,
      // A throwaway repository root, and no browser popping up in a test run.
      env: { ...process.env, NOESIS_ROOT: repoRoot, NOESIS_OPEN_BROWSER: '0' },
      stderr: 'ignore',
    }),
  );
}, 30_000);

afterAll(async () => {
  await client?.close();
  if (repoRoot) await rm(repoRoot, { recursive: true, force: true });
});

describe('MCP over stdio against the real service (e2e)', () => {
  it('names the repository root in the instructions', () => {
    expect(client.getInstructions()).toContain(repoRoot);
  });

  it('lists the tools and answers a call in-process', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('hello');

    const result = await client.callTool({
      name: 'hello',
      arguments: { name: 'Ada' },
    });
    expect(result.isError).toBeFalsy();
    const [content] = result.content as { type: string; text: string }[];
    expect(content?.text).toBe('Greetings, Ada!');
  });
});
