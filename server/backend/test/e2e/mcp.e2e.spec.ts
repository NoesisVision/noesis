// Walks the import flow of decision D3 against the real service over stdio,
// the way an agent host runs it.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { designDocFixture } from '#backend/app/design-docs/model/design-doc.fixture';
import { serviceEnv, textOf } from '../support/service-process';

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
      env: serviceEnv(repoRoot),
      stderr: 'ignore',
    }),
  );
}, 30_000);

afterAll(async () => {
  if (repoRoot) await rm(repoRoot, { recursive: true, force: true });
});

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

function sessionDir(): string {
  const match = (client.getInstructions() ?? '').match(
    /scratch directory is (\S+) /,
  );
  if (!match?.[1]) throw new Error('instructions name no scratch directory');
  return match[1];
}

describe('MCP over stdio against the real service (e2e)', () => {
  it('names the repository root and a scratch directory under .noesis/tmp/', async () => {
    expect(client.getInstructions()).toContain(repoRoot);
    const dir = sessionDir();
    expect(dir.startsWith(join(repoRoot, '.noesis', 'tmp'))).toBe(true);
    expect(await exists(dir)).toBe(true);
  });

  it('validates and imports a working file in-process', async () => {
    const path = join(sessionDir(), 'design-doc.json');
    await writeFile(path, JSON.stringify(designDocFixture));

    const validated = await client.callTool({
      name: 'validate',
      arguments: { contract: 'design-document', path },
    });
    expect(textOf(validated)).toBe('Valid design-document: no issues.');

    const missing = await client.callTool({
      name: 'create-design-doc',
      arguments: { change: 'booking', path },
    });
    // No change directory yet: the tool says so instead of writing anywhere.
    expect(missing.isError).toBe(true);
    expect(textOf(missing)).toContain('No change "booking"');
  });

  it('deletes the scratch directory when the session ends', async () => {
    const dir = sessionDir();
    await client.close();

    // The service shuts down when stdin ends; give it a moment to do so.
    const deadline = Date.now() + 5_000;
    while ((await exists(dir)) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(await exists(dir)).toBe(false);
  }, 10_000);
});
