// Full-stack MCP e2e: boots the real server app, then drives the stdio MCP
// entry (src/main.ts) through an actual `tools/call` — covering the REST hop
// from ServerClient to the server's /api surface. tools/list alone does not
// exercise that hop (a broken path slipped through before).
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { type ChildProcess, spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const bridgeRoot = resolve(__dirname, '../..');
const serverRoot = resolve(__dirname, '../../../../server/backend');

const PORT = 3917;
const SERVER_URL = `http://localhost:${PORT}`;

let serverProcess: ChildProcess;
let client: Client;

async function waitForHealth(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${SERVER_URL}/internal/health`);
      if (res.ok) return;
    } catch {
      // server not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server did not become healthy within ${timeoutMs}ms`);
}

beforeAll(async () => {
  serverProcess = spawn('bun', ['run', 'src/main.ts'], {
    cwd: serverRoot,
    // In-memory DB so the e2e run touches no on-disk data dir.
    env: { ...process.env, PORT: String(PORT), NOESIS_DATA_DIR: ':memory:' },
    stdio: 'ignore',
  });
  await waitForHealth(15_000);

  client = new Client({ name: 'mcp-e2e-test', version: '0.0.0' });
  await client.connect(
    new StdioClientTransport({
      command: 'bun',
      args: ['run', 'src/main.ts'],
      cwd: bridgeRoot,
      env: { ...process.env, NOESIS_SERVER_URL: SERVER_URL },
      stderr: 'ignore',
    }),
  );
}, 30_000);

afterAll(async () => {
  await client?.close();
  serverProcess?.kill();
});

describe('MCP server against the running server app (e2e)', () => {
  it('hello tool fetches the greeting over the /api surface', async () => {
    const result = await client.callTool({
      name: 'hello',
      arguments: { name: 'E2E' },
    });

    expect(result.isError).toBeFalsy();
    const [content] = result.content as { type: string; text: string }[];
    expect(content?.type).toBe('text');
    expect(content?.text).toBe('Hello World! Greetings, E2E!');
  }, 15_000);
});
