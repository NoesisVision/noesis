// Walks the tools against the real service over stdio, the way an agent host
// runs it: `attach`, which starts the repository's backend. `serveStdio` picks the era from the client's opening, so the
// modern revision and the 2025 fallback are both exercised here — an
// InMemoryTransport pair cannot reach the modern era.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client, type ClientOptions } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { LOG_FILE_SUFFIX } from '#backend/platform/logging/logging';
import {
  serviceEnv,
  serviceRoot,
  stopService,
} from '../support/service-process';
import { textOf } from '../support/tool-result';

interface Service {
  repoRoot: string;
  client: Client;
}

const started: Service[] = [];

async function startService(
  options?: ClientOptions,
  env: Record<string, string> = {},
): Promise<Service> {
  const repoRoot = await mkdtemp(join(tmpdir(), 'noesis-root-'));
  const client = new Client(
    { name: 'mcp-e2e-test', version: '0.0.0' },
    options,
  );
  await client.connect(
    new StdioClientTransport({
      command: 'bun',
      args: ['run', 'src/main.ts', 'attach'],
      cwd: serviceRoot,
      env: { ...serviceEnv(repoRoot), ...env },
      stderr: 'ignore',
    }),
  );
  const service = { repoRoot, client };
  started.push(service);
  return service;
}

afterAll(async () => {
  for (const { repoRoot } of started) {
    stopService(repoRoot);
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
  const path = tools.find(
    (tool) => tool.name === 'add_source_document_to_change',
  )?.inputSchema.properties?.path as { description?: string } | undefined;
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
    expect(client.getInstructions()).toContain('.noesis/sessions/');
  });

  it('advertises a live scratch directory under .noesis/sessions/', async () => {
    const dir = await sessionDir(client);
    expect(dir.startsWith(join(service.repoRoot, '.noesis', 'sessions'))).toBe(
      true,
    );
    expect(await exists(dir)).toBe(true);
  });

  it('offers the seven tools it was started with', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'add_design_doc_to_change',
      'add_source_document_to_change',
      'create_change',
      'list_changes',
      'update_change',
      'update_design_doc_in_change',
      'update_source_document_in_change',
    ]);
  });

  it('creates a change and adds a document to it, each written to the scratch directory', async () => {
    const changeFile = join(await sessionDir(client), 'change.json');
    await writeFile(
      changeFile,
      JSON.stringify({
        name: 'Payment retry',
        key: 'NOE-142',
        type: 'feature',
      }),
    );
    const created = await client.callTool({
      name: 'create_change',
      arguments: { path: changeFile },
    });
    expect(created.isError).toBeFalsy();
    const { change } = created.structuredContent as { change: { id: string } };
    expect(change.id).toMatch(/^\d{4}-\d{2}-\d{2}-payment-retry$/);

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
      name: 'add_source_document_to_change',
      arguments: { change: change.id, path },
    });

    expect(added.isError).toBeFalsy();
    const { sourceDocument: document } = added.structuredContent as {
      sourceDocument: { id: string };
    };
    expect(document.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
    const stored = JSON.parse(
      await readFile(
        join(
          service.repoRoot,
          '.noesis',
          'graph',
          'changes',
          `${change.id}.change.json`,
        ),
        'utf8',
      ),
    ) as { version: number; sourceDocuments: { id: string }[] };
    expect(stored.version).toBe(2);
    expect(stored.sourceDocuments.map((d) => d.id)).toEqual([document.id]);
  }, 15_000);

  it('answers an unknown change in-band, having written nothing', async () => {
    const path = join(await sessionDir(client), 'orphan.json');
    await writeFile(
      path,
      JSON.stringify({
        title: 'Orphan',
        date: '2026-09-18',
        content: 'x',
      }),
    );

    const result = await client.callTool({
      name: 'add_source_document_to_change',
      arguments: { change: '2026-09-18-booking', path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No change "2026-09-18-booking"');
    const changes = join(service.repoRoot, '.noesis', 'graph', 'changes');
    expect(await exists(join(changes, '2026-09-18-booking.change.json'))).toBe(
      false,
    );
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
      'add_design_doc_to_change',
      'add_source_document_to_change',
      'create_change',
      'list_changes',
      'update_change',
      'update_design_doc_in_change',
      'update_source_document_in_change',
    ]);

    const path = join(await sessionDir(client), 'change.json');
    await writeFile(
      path,
      JSON.stringify({ name: 'Legacy era', type: 'chore' }),
    );
    const created = await client.callTool({
      name: 'create_change',
      arguments: { path },
    });
    expect(created.structuredContent).toMatchObject({
      change: { name: 'Legacy era', status: 'discovery' },
    });
  }, 15_000);
});

// The backend waits for a session, so the SDK's throwaway era probe never
// starts one, binds a port or opens a browser.
describe('the backend behind a session (e2e)', () => {
  let service: Service;

  beforeAll(async () => {
    service = await startService({
      versionNegotiation: { mode: { pin: '2026-07-28' } },
    });
  }, 30_000);

  afterAll(() => service.client.close());

  const noesisPath = (...segments: string[]) =>
    join(service.repoRoot, '.noesis', ...segments);

  it('starts on the first request that is not the era probe, once', async () => {
    // Both processes serve MCP: the throwaway probe and the one that stays.
    await until(
      async () =>
        occurrences(
          await logText(noesisPath('logs')),
          'MCP server serving on stdio',
        ) === 2,
    );
    expect(await exists(noesisPath('server.lock'))).toBe(false);
    expect(await exists(noesisPath('logs', 'noesis-serve.log'))).toBe(false);

    await service.client.callTool({ name: 'list_changes', arguments: {} });

    expect(await exists(noesisPath('server.lock'))).toBe(true);
    const serveLog = await readFile(
      noesisPath('logs', 'noesis-serve.log'),
      'utf8',
    );
    expect(occurrences(serveLog, 'listening on')).toBe(1);
    const logs = (await readdir(noesisPath('logs'))).filter((name) =>
      name.endsWith(LOG_FILE_SUFFIX),
    );
    expect(logs.filter((name) => name === 'noesis-serve.log')).toHaveLength(1);
  }, 30_000);
});

// For sandboxes that refuse a detached spawn: one process, MCP and ui
// together, and no lock taken.
describe('direct mode (e2e)', () => {
  let service: Service;

  beforeAll(async () => {
    service = await startService(
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
      { NOESIS_NO_DAEMON: '1' },
    );
  }, 30_000);

  afterAll(() => service.client.close());

  it('serves the tools in-process, starts the ui on the first real request, and takes no lock', async () => {
    const logs = join(service.repoRoot, '.noesis', 'logs');
    expect(await logText(logs)).not.toContain('listening on');

    const path = join(await sessionDir(service.client), 'change.json');
    await writeFile(path, JSON.stringify({ name: 'Direct', type: 'chore' }));
    const created = await service.client.callTool({
      name: 'create_change',
      arguments: { path },
    });

    expect(created.isError).toBeFalsy();
    await until(async () => (await logText(logs)).includes('listening on'));
    expect(occurrences(await logText(logs), 'listening on')).toBe(1);
    expect(await exists(join(service.repoRoot, '.noesis', 'server.lock'))).toBe(
      false,
    );
    expect(await exists(join(logs, 'noesis-serve.log'))).toBe(false);
  }, 30_000);
});

// Every process logs to a file of its own: the probe's, the session's and
// the backend's.
async function logText(dir: string): Promise<string> {
  const names = (await readdir(dir)).filter((name) =>
    name.endsWith(LOG_FILE_SUFFIX),
  );
  const texts = await Promise.all(
    names.map((name) => readFile(join(dir, name), 'utf8')),
  );
  return texts.join('');
}
