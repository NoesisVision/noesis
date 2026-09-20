// Walks the two tools against the real service over stdio, the way an agent
// host runs it. `serveStdio` picks the era from the client's opening, so the
// modern revision and the 2025 fallback are both exercised here — an
// InMemoryTransport pair cannot reach the modern era.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client, type ClientOptions } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { LOG_FILE_NAME } from '#backend/platform/logging/logging';
import { serviceEnv, textOf } from '../support/service-process';

const serviceRoot = resolve(__dirname, '../..');

interface Service {
  repoRoot: string;
  client: Client;
}

const started: Service[] = [];

async function startService(options?: ClientOptions): Promise<Service> {
  const repoRoot = await mkdtemp(join(tmpdir(), 'noesis-root-'));
  const client = new Client(
    { name: 'mcp-e2e-test', version: '0.0.0' },
    options,
  );
  await client.connect(
    new StdioClientTransport({
      command: 'bun',
      args: ['run', 'src/main.ts'],
      cwd: serviceRoot,
      env: serviceEnv(repoRoot),
      stderr: 'ignore',
    }),
  );
  const service = { repoRoot, client };
  started.push(service);
  return service;
}

afterAll(async () => {
  for (const { repoRoot } of started) {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

const occurrences = (text: string, needle: string) =>
  text.split(needle).length - 1;

async function until(
  condition: () => Promise<boolean>,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition()) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

/**
 * From the tool schema, not from `instructions`: on a modern connection the
 * instructions come from the SDK's throwaway probe process, while
 * `tools/list` is answered by the process that serves the session.
 */
async function sessionDir(client: Client): Promise<string> {
  const { tools } = await client.listTools();
  const path = tools.find((tool) => tool.name === 'add_document_to_change')
    ?.inputSchema.properties?.path as { description?: string } | undefined;
  const match = /scratch directory, (\S+?),/.exec(path?.description ?? '');
  if (!match?.[1]) throw new Error('no scratch directory in the tool schema');
  return match[1];
}

describe('MCP over stdio on the 2026-07-28 revision (e2e)', () => {
  let service: Service;
  let client: Client;

  beforeAll(async () => {
    service = await startService({
      versionNegotiation: { mode: { pin: '2026-07-28' } },
    });
    client = service.client;
  }, 30_000);

  it('pins the modern era, with no 2025 handshake behind it', () => {
    expect(client.getProtocolEra()).toBe('modern');
    expect(client.getNegotiatedProtocolVersion()).toBe('2026-07-28');
  });

  it('names the repository root in its instructions', () => {
    expect(client.getInstructions()).toContain(service.repoRoot);
    expect(client.getInstructions()).toContain('.noesis/tmp/');
  });

  it('advertises a live scratch directory under .noesis/tmp/', async () => {
    const dir = await sessionDir(client);
    expect(dir.startsWith(join(service.repoRoot, '.noesis', 'tmp'))).toBe(true);
    expect(await exists(dir)).toBe(true);
  });

  it('offers the two tools it was started with', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'add_document_to_change',
      'create_change',
    ]);
  });

  it('creates a change and adds a document written to the scratch directory', async () => {
    const created = await client.callTool({
      name: 'create_change',
      arguments: { name: 'Payment retry', key: 'NOE-142', type: 'feature' },
    });
    expect(created.isError).toBeFalsy();
    expect(created.structuredContent).toMatchObject({ slug: 'payment-retry' });

    const path = join(await sessionDir(client), 'document.json');
    await writeFile(
      path,
      JSON.stringify({
        title: 'Retry interview',
        date: '2026-09-18',
        content: 'Support hears about double charges after a failed retry.',
      }),
    );

    const added = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: 'payment-retry', path },
    });

    expect(added.isError).toBeFalsy();
    const stored = (added.structuredContent as { path: string }).path;
    expect(stored.startsWith(join(service.repoRoot, '.noesis', 'graph'))).toBe(
      true,
    );
    expect(await exists(stored)).toBe(true);
  }, 15_000);

  it('answers an unknown change in-band, having written nothing', async () => {
    const path = join(await sessionDir(client), 'orphan.json');
    await writeFile(
      path,
      JSON.stringify({ title: 'Orphan', date: '2026-09-18', content: 'x' }),
    );

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: 'booking', path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No change "booking"');
    const changes = join(service.repoRoot, '.noesis', 'graph', 'changes');
    expect(await exists(join(changes, 'booking'))).toBe(false);
  });

  it('deletes the scratch directory when the session ends', async () => {
    const dir = await sessionDir(client);
    await client.close();

    // The service shuts down when stdin ends; give it a moment to do so.
    const deadline = Date.now() + 5_000;
    while ((await exists(dir)) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(await exists(dir)).toBe(false);
  }, 10_000);
});

// A host that has not adopted the modern revision opens with the 2025
// `initialize` handshake; `serveStdio` serves it from the same factory.
describe('MCP over stdio for a 2025-era host (e2e)', () => {
  let client: Client;

  beforeAll(async () => {
    ({ client } = await startService());
  }, 30_000);

  afterAll(async () => {
    await client.close();
  });

  it('falls back to the legacy era and serves the same tools', async () => {
    expect(client.getProtocolEra()).toBe('legacy');
    expect(client.getNegotiatedProtocolVersion()).toBe('2025-11-25');

    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'add_document_to_change',
      'create_change',
    ]);

    const created = await client.callTool({
      name: 'create_change',
      arguments: { name: 'Legacy era', type: 'chore' },
    });
    expect(created.structuredContent).toMatchObject({ slug: 'legacy-era' });
  }, 15_000);
});

// The heavy half — database, graph index, watcher, page — waits for a session,
// so the SDK's throwaway era probe never pays for one.
describe('the graph and ui half (e2e)', () => {
  let service: Service;

  beforeAll(async () => {
    service = await startService({
      versionNegotiation: { mode: { pin: '2026-07-28' } },
    });
  }, 30_000);

  afterAll(() => service.client.close());

  const logText = () =>
    readFile(join(service.repoRoot, '.noesis', 'logs', LOG_FILE_NAME), 'utf8');

  it('starts on the first request that is not the era probe, in the serving process alone', async () => {
    // Both processes serve MCP: the throwaway probe and the one that stays.
    await until(
      async () =>
        occurrences(await logText(), 'MCP server serving on stdio') === 2,
    );
    expect(await logText()).not.toContain('listening on');

    await service.client.listTools();

    await until(async () => (await logText()).includes('listening on'));
    expect(occurrences(await logText(), 'listening on')).toBe(1);
  }, 30_000);
});
