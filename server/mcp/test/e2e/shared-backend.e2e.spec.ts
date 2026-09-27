// Two sessions in one repository share one backend: one lock, one port, one
// writer on the graph. Runs the real shim and backend from source.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import {
  attachedUrl,
  serviceEnv,
  serviceRoot,
  startServing,
  stopService,
} from '../support/service-process';

const GRACE_MS = 1_500;

let repoRoot: string;

beforeAll(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'noesis-shared-'));
});

afterAll(async () => {
  stopService(repoRoot);
  await rm(repoRoot, { recursive: true, force: true });
});

const env = () => ({
  ...serviceEnv(repoRoot),
  NOESIS_GRACE_MS: String(GRACE_MS),
});
const lockPath = () => join(repoRoot, '.noesis', 'server.lock');

interface Session {
  client: Client;
  transport: StdioClientTransport;
  url: Promise<string>;
}

async function startSession(): Promise<Session> {
  const transport = new StdioClientTransport({
    command: 'bun',
    args: ['run', 'src/main.ts', 'attach'],
    cwd: serviceRoot,
    env: env(),
    stderr: 'pipe',
  });
  const url = attachedUrl(transport.stderr ?? process.stderr, 15_000);
  const client = new Client({ name: 'shared-e2e', version: '0.0.0' });
  await client.connect(transport);
  return { client, transport, url };
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

/** The backend's own count, from the last line it logged about it. */
async function attachedSessions(): Promise<number | undefined> {
  const log = await readFile(
    join(repoRoot, '.noesis', 'logs', 'noesis-serve.log'),
    'utf8',
  );
  const counts = log
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { properties?: { sessions?: number } })
    .map((record) => record.properties?.sessions)
    .filter((sessions) => sessions !== undefined);
  return counts.at(-1);
}

async function until(
  condition: () => Promise<boolean>,
  timeoutMs = 10_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return true;
    await sleep(50);
  }
  return condition();
}

function backendPid(): Promise<number> {
  return readFile(lockPath(), 'utf8').then(
    (text) => (JSON.parse(text) as { pid: number }).pid,
  );
}

const running = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe('one backend shared by every session (e2e)', () => {
  let first: Session;
  let second: Session;

  it('serves two sessions from one backend on one port', async () => {
    first = await startSession();
    second = await startSession();
    await first.client.callTool({ name: 'list_changes', arguments: {} });

    const [firstUrl, secondUrl] = await Promise.all([first.url, second.url]);
    expect(firstUrl).toBe(secondUrl);
    expect(await exists(lockPath())).toBe(true);

    const path = join(repoRoot, '.noesis', 'sessions', 'shared.json');
    await writeFile(path, JSON.stringify({ name: 'Shared', type: 'chore' }));
    const created = await first.client.callTool({
      name: 'create_change',
      arguments: { path },
    });
    expect(created.isError).toBeFalsy();
    const listed = await second.client.callTool({
      name: 'list_changes',
      arguments: {},
    });
    expect(listed.structuredContent).toMatchObject({
      changes: [{ name: 'Shared' }],
    });
  }, 30_000);

  it('keeps both sessions attached past the server idle timeout', async () => {
    await sleep(11_000);

    expect(await attachedSessions()).toBe(2);
  }, 15_000);

  it('stays up when one session is killed, and exits after the grace once both are', async () => {
    const pid = await backendPid();

    process.kill(first.transport.pid ?? 0, 'SIGKILL');
    expect(await until(async () => (await attachedSessions()) === 1)).toBe(
      true,
    );
    await sleep(GRACE_MS * 2);
    expect(running(pid)).toBe(true);

    process.kill(second.transport.pid ?? 0, 'SIGKILL');
    expect(
      await until(async () => !running(pid) && !(await exists(lockPath()))),
    ).toBe(true);
  }, 30_000);

  it('stops the backend with a session attached through noesis stop', async () => {
    const session = await startSession();
    await session.client.callTool({ name: 'list_changes', arguments: {} });
    const pid = await backendPid();

    const started = Date.now();
    stopService(repoRoot);

    expect(running(pid)).toBe(false);
    expect(await exists(lockPath())).toBe(false);
    expect(Date.now() - started).toBeLessThan(10_000);
    await session.client.close();
  }, 30_000);

  it('ends a session whose host drops its stdin, and the backend counts it gone', async () => {
    const keeper = await startSession();
    await keeper.client.callTool({ name: 'list_changes', arguments: {} });
    const shim = spawn('bun', ['run', 'src/main.ts', 'attach'], {
      cwd: serviceRoot,
      env: env(),
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    const url = attachedUrl(shim, 15_000);
    startServing(shim);
    await url;
    expect(await until(async () => (await attachedSessions()) === 2)).toBe(
      true,
    );

    const exited = new Promise((resolveExit) => shim.once('exit', resolveExit));
    shim.stdin.destroy();

    await exited;
    expect(await until(async () => (await attachedSessions()) === 1)).toBe(
      true,
    );
    await keeper.client.close();
  }, 30_000);
});
